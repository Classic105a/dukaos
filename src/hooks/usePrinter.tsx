import { useState, useCallback, useRef } from 'react';
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
  isBluetoothSupported,
  isUSBSupported,
  printViaBrowserFallback,
  type ReceiptData,
  type PrinterConfig,
  type BluetoothPrinter,
  type USBPrinter,
} from '@/lib/escpos';
import { toast } from 'sonner';
import { isNativeApp } from '@/lib/escpos';
import { isNativeBluetoothPrintAvailable, printNativeNetwork } from '@/lib/native-printing';

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

export interface PrintResult {
  success: boolean;
  method: 'thermal' | 'browser' | 'none';
  error?: string;
}

export const usePrinter = () => {
  const { currentBranch } = useBranch();
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Cache connected printers for reuse
  const bluetoothPrinterRef = useRef<BluetoothPrinter | null>(null);
  const usbPrinterRef = useRef<USBPrinter | null>(null);

  // Fetch default printer configuration
  const { data: defaultPrinter, isLoading: printerLoading } = useQuery({
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

      if (error) {
        console.error('Network print edge function error:', error);
        throw new Error(error.message || 'Network print failed');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Print request failed');
      }
      
      return true;
    } catch (error) {
      console.error('Network print error:', error);
      throw error;
    }
  }, []);

  // Build receipt data from settings
  const buildReceiptSettings = useCallback(() => {
    if (!receiptSettings) return {};
    
    return {
      showLogo: receiptSettings.show_logo ?? undefined,
      showBusinessName: receiptSettings.show_business_name ?? undefined,
      showBranchName: receiptSettings.show_branch_name ?? undefined,
      showAddress: receiptSettings.show_address ?? undefined,
      showPhone: receiptSettings.show_phone ?? undefined,
      showEmail: receiptSettings.show_email ?? undefined,
      showWebsite: receiptSettings.show_website ?? undefined,
      showMpesaTill: receiptSettings.show_mpesa_till ?? undefined,
      showMpesaPaybill: receiptSettings.show_mpesa_paybill ?? undefined,
      showKraPin: receiptSettings.show_kra_pin ?? undefined,
      showCashierName: receiptSettings.show_cashier_name ?? undefined,
      showCustomerName: receiptSettings.show_customer_name ?? undefined,
      showDateTime: receiptSettings.show_date_time ?? undefined,
      showReceiptNumber: receiptSettings.show_receipt_number ?? undefined,
      showItemSku: receiptSettings.show_item_sku ?? undefined,
      showItemTax: receiptSettings.show_item_tax ?? undefined,
      showSubtotal: receiptSettings.show_subtotal ?? undefined,
      showTotalTax: receiptSettings.show_total_tax ?? undefined,
      showDiscount: receiptSettings.show_discount ?? undefined,
      showFooterMessage: receiptSettings.show_footer_message ?? undefined,
      footerMessage: receiptSettings.footer_message || 'Thank you for your business!',
      showReturnPolicy: receiptSettings.show_return_policy ?? undefined,
      returnPolicy: receiptSettings.return_policy || '',
    };
  }, [receiptSettings]);

  // Main print function
  const printReceipt = useCallback(async (
    receiptData: ReceiptData,
    options?: { fallbackToBrowser?: boolean; receiptHtml?: string }
  ): Promise<PrintResult> => {
    setIsPrinting(true);
    setLastError(null);

    const fallbackToBrowser = options?.fallbackToBrowser ?? true;

    try {
      // If no printer configured, use browser fallback
      if (!defaultPrinter) {
        if (fallbackToBrowser && options?.receiptHtml) {
          printViaBrowserFallback(options.receiptHtml, receiptData.receiptNumber);
          return { success: true, method: 'browser' };
        }
        throw new Error('No printer configured. Please set up a printer in Settings.');
      }

      const printerConfig: PrinterConfig = {
        paperWidth: (defaultPrinter.paper_width || 80) as 58 | 80,
        charactersPerLine: defaultPrinter.characters_per_line || 48,
        brand: (defaultPrinter.printer_brand || 'generic') as 'xprinter' | 'epson' | 'generic',
      };

      const settings = buildReceiptSettings();
      const receiptText = buildReceiptText(receiptData, settings, printerConfig);
      const receiptBytes = textToBytes(receiptText);

      let success = false;

      switch (defaultPrinter.connection_type) {
        case 'ethernet': {
          if (!defaultPrinter.ip_address) {
            throw new Error('Printer IP address not configured');
          }
          // On native (Android/iOS), prefer the device's own TCP socket so we don't
          // round-trip through an edge function that can't reach a LAN-only printer.
          if (isNativeApp()) {
            try {
              const r = await printNativeNetwork(
                defaultPrinter.ip_address,
                defaultPrinter.port || 9100,
                receiptBytes
              );
              if (r.success) { success = true; break; }
              console.warn('[Printer] native TCP unavailable:', r.error);
            } catch (e) {
              console.warn('[Printer] native TCP failed:', e);
            }
          }
          // Edge functions run in the public cloud and cannot reach LAN printers
          // (e.g. 192.168.x.x). Skip the network attempt on web — the caller's
          // browser fallback (receiptHtml) will handle it.
          throw new Error(
            isNativeApp()
              ? 'Printer unreachable on local network'
              : 'Network printers require the mobile app. Using browser print instead.'
          );
        }

        case 'bluetooth': {
          if (!isBluetoothSupported()) {
            throw new Error('Bluetooth not supported. Use Chrome on desktop or Android.');
          }
          
          // Try to reuse existing connection
          if (!bluetoothPrinterRef.current || !bluetoothPrinterRef.current.device.gatt?.connected) {
            toast.info('Connecting to Bluetooth printer...', { duration: 2000 });
            const printer = await connectBluetoothPrinter();
            if (!printer) {
              throw new Error('Failed to connect to Bluetooth printer');
            }
            bluetoothPrinterRef.current = printer;
          }
          
          success = await printViaBluetooth(bluetoothPrinterRef.current, receiptBytes);
          break;
        }

        case 'usb': {
          if (!isUSBSupported()) {
            throw new Error('WebUSB not supported. Use Chrome on desktop.');
          }
          
          // Try to reuse existing connection
          if (!usbPrinterRef.current) {
            toast.info('Connecting to USB printer...', { duration: 2000 });
            const printer = await connectUSBPrinter();
            if (!printer) {
              throw new Error('Failed to connect to USB printer');
            }
            usbPrinterRef.current = printer;
          }
          
          success = await printViaUSB(usbPrinterRef.current, receiptBytes);
          break;
        }

        default:
          throw new Error(`Unknown printer connection type: ${defaultPrinter.connection_type}`);
      }

      if (success) {
        // Update last_connected_at
        await supabase
          .from('printer_configurations')
          .update({ last_connected_at: new Date().toISOString() })
          .eq('id', defaultPrinter.id);
          
        return { success: true, method: 'thermal' };
      } else {
        throw new Error('Print command sent but no confirmation received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown print error';
      console.error('Print error:', errorMessage);
      setLastError(errorMessage);
      
      // Try browser fallback if enabled
      if (fallbackToBrowser && options?.receiptHtml) {
        try {
          printViaBrowserFallback(options.receiptHtml, receiptData.receiptNumber);
          toast.warning('Thermal print failed. Using browser print instead.', { duration: 4000 });
          return { success: true, method: 'browser', error: errorMessage };
        } catch (fallbackError) {
          return { 
            success: false, 
            method: 'none', 
            error: `Thermal: ${errorMessage}. Browser: ${fallbackError instanceof Error ? fallbackError.message : 'Failed'}` 
          };
        }
      }
      
      return { success: false, method: 'none', error: errorMessage };
    } finally {
      setIsPrinting(false);
    }
  }, [defaultPrinter, buildReceiptSettings, printViaNetwork]);

  // Check printer capabilities
  const getPrinterCapabilities = useCallback(() => {
    return {
      bluetooth: isBluetoothSupported(),
      usb: isUSBSupported(),
      network: true, // Always supported via edge function
      browser: true, // Always supported
    };
  }, []);

  return {
    defaultPrinter,
    isPrinting,
    printerLoading,
    printReceipt,
    hasPrinter: !!defaultPrinter,
    lastError,
    getPrinterCapabilities,
    receiptSettings,
    buildReceiptSettings,
  };
};
