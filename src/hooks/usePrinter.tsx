import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { useQuery } from '@tanstack/react-query';
import {
  buildReceiptText,
  textToBytes,
  connectBluetoothPrinter,
  printViaBluetooth,
  connectUSBPrinter,
  printViaUSB,
  type ReceiptData,
  type PrinterConfig,
  type BluetoothPrinter,
  type USBPrinter,
} from '@/lib/escpos';
import { toast } from 'sonner';

interface PrinterConfiguration {
  id: string;
  name: string;
  connection_type: string;
  ip_address: string | null;
  port: number | null;
  paper_width: number;
  characters_per_line: number;
  printer_brand: string;
  is_default: boolean;
}

export const usePrinter = () => {
  const { currentBranch } = useBranch();
  const [isPrinting, setIsPrinting] = useState(false);
  const [bluetoothPrinter, setBluetoothPrinter] = useState<BluetoothPrinter | null>(null);
  const [usbPrinter, setUsbPrinter] = useState<USBPrinter | null>(null);

  // Fetch default printer configuration
  const { data: defaultPrinter } = useQuery({
    queryKey: ['default-printer', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return null;
      const { data, error } = await supabase
        .from('printer_configurations')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as PrinterConfiguration | null;
    },
    enabled: !!currentBranch?.id,
  });

  // Fetch receipt settings
  const { data: receiptSettings } = useQuery({
    queryKey: ['receipt-settings', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return null;
      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentBranch?.id,
  });

  // Print via network (edge function)
  const printViaNetwork = useCallback(async (
    printerIp: string,
    printerPort: number,
    receiptBytes: Uint8Array
  ): Promise<boolean> => {
    try {
      // Convert bytes to base64
      const base64Data = btoa(String.fromCharCode(...receiptBytes));
      
      const { data, error } = await supabase.functions.invoke('print-receipt', {
        body: {
          printerIp,
          printerPort,
          receiptData: base64Data,
        },
      });

      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Network print error:', error);
      return false;
    }
  }, []);

  // Main print function
  const printReceipt = useCallback(async (receiptData: ReceiptData): Promise<boolean> => {
    if (!defaultPrinter) {
      toast.error('No default printer configured');
      return false;
    }

    setIsPrinting(true);

    try {
      const printerConfig: PrinterConfig = {
        paperWidth: (defaultPrinter.paper_width || 80) as 58 | 80,
        charactersPerLine: defaultPrinter.characters_per_line || 48,
        brand: (defaultPrinter.printer_brand || 'generic') as 'xprinter' | 'epson' | 'generic',
      };

      // Build receipt settings from DB
      const settings = receiptSettings ? {
        showLogo: receiptSettings.show_logo,
        showBusinessName: receiptSettings.show_business_name,
        showBranchName: receiptSettings.show_branch_name,
        showAddress: receiptSettings.show_address,
        showPhone: receiptSettings.show_phone,
        showEmail: receiptSettings.show_email,
        showWebsite: receiptSettings.show_website,
        showMpesaTill: receiptSettings.show_mpesa_till,
        showMpesaPaybill: receiptSettings.show_mpesa_paybill,
        showKraPin: receiptSettings.show_kra_pin,
        showCashierName: receiptSettings.show_cashier_name,
        showCustomerName: receiptSettings.show_customer_name,
        showDateTime: receiptSettings.show_date_time,
        showReceiptNumber: receiptSettings.show_receipt_number,
        showItemSku: receiptSettings.show_item_sku,
        showItemTax: receiptSettings.show_item_tax,
        showSubtotal: receiptSettings.show_subtotal,
        showTotalTax: receiptSettings.show_total_tax,
        showDiscount: receiptSettings.show_discount,
        showFooterMessage: receiptSettings.show_footer_message,
        footerMessage: receiptSettings.footer_message || 'Thank you for your business!',
        showReturnPolicy: receiptSettings.show_return_policy,
        returnPolicy: receiptSettings.return_policy || '',
      } : {};

      // Build ESC/POS receipt text
      const receiptText = buildReceiptText(receiptData, settings, printerConfig);
      const receiptBytes = textToBytes(receiptText);

      let success = false;

      switch (defaultPrinter.connection_type) {
        case 'ethernet':
          if (defaultPrinter.ip_address) {
            success = await printViaNetwork(
              defaultPrinter.ip_address,
              defaultPrinter.port || 9100,
              receiptBytes
            );
          }
          break;

        case 'bluetooth':
          if (!bluetoothPrinter) {
            const printer = await connectBluetoothPrinter();
            if (printer) {
              setBluetoothPrinter(printer);
              success = await printViaBluetooth(printer, receiptBytes);
            }
          } else {
            success = await printViaBluetooth(bluetoothPrinter, receiptBytes);
          }
          break;

        case 'usb':
          if (!usbPrinter) {
            const printer = await connectUSBPrinter();
            if (printer) {
              setUsbPrinter(printer);
              success = await printViaUSB(printer, receiptBytes);
            }
          } else {
            success = await printViaUSB(usbPrinter, receiptBytes);
          }
          break;

        default:
          toast.error('Unknown printer connection type');
          return false;
      }

      if (success) {
        // Update last_connected_at
        await supabase
          .from('printer_configurations')
          .update({ last_connected_at: new Date().toISOString() })
          .eq('id', defaultPrinter.id);
      }

      return success;
    } catch (error) {
      console.error('Print error:', error);
      return false;
    } finally {
      setIsPrinting(false);
    }
  }, [defaultPrinter, receiptSettings, bluetoothPrinter, usbPrinter, printViaNetwork]);

  return {
    defaultPrinter,
    isPrinting,
    printReceipt,
    hasPrinter: !!defaultPrinter,
  };
};