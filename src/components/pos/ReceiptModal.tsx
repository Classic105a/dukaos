import { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Share2, Check, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { usePrinter } from '@/hooks/usePrinter';
import type { CartItem } from './Cart';
import type { ReceiptData } from '@/lib/escpos';
import JsBarcode from 'jsbarcode';
import { toast } from 'sonner';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNumber: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
    mpesa_reference?: string;
  }>;
  cashierName?: string;
  cashReceived?: number;
  changeGiven?: number;
  branchName?: string;
  branchAddress?: string | null;
  branchCity?: string | null;
  branchPhone?: string | null;
  mpesaTill?: string | null;
  mpesaPaybill?: string | null;
  mpesaAccount?: string | null;
  kraPin?: string | null;
  customerName?: string;
  footerMessage?: string;
}

const ReceiptModal = ({
  isOpen,
  onClose,
  receiptNumber,
  items,
  subtotal,
  tax,
  discount,
  total,
  payments,
  cashierName,
  branchName,
  branchAddress,
  branchCity,
  branchPhone,
  mpesaTill,
  mpesaPaybill,
  mpesaAccount,
  kraPin,
  customerName,
  cashReceived,
  changeGiven,
  footerMessage = 'Thank you for your business!'
}: ReceiptModalProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const date = format(new Date(), 'dd/MM/yyyy HH:mm');
  
  const { printReceipt, isPrinting, hasPrinter, defaultPrinter, getPrinterCapabilities } = usePrinter();
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');

  // Generate barcode when receipt number changes
  useEffect(() => {
    if (barcodeRef.current && receiptNumber && isOpen) {
      try {
        JsBarcode(barcodeRef.current, receiptNumber.replace(/[^A-Z0-9]/gi, ''), {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 5,
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [receiptNumber, isOpen]);

  // Reset print status when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrintStatus('idle');
    }
  }, [isOpen]);

  // Build receipt data for thermal printing
  const buildReceiptData = (): ReceiptData => ({
    header: {
      businessName: 'DukaOS',
      branchName: branchName || undefined,
      address: branchAddress || undefined,
      city: branchCity || undefined,
      phone: branchPhone || undefined,
      mpesaTill: mpesaTill || undefined,
      mpesaPaybill: mpesaPaybill || undefined,
      mpesaAccount: mpesaAccount || undefined,
      kraPin: kraPin || undefined,
    },
    receiptNumber,
    date: new Date(),
    cashierName: cashierName,
    customerName: customerName,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total,
    })),
    subtotal,
    taxAmount: tax,
    discountAmount: discount,
    totalAmount: total,
    payments: payments.map(p => ({
      method: p.method.toUpperCase(),
      amount: p.amount,
      reference: p.mpesa_reference,
    })),
    footer: {
      message: footerMessage,
    },
  });

  const handlePrint = async () => {
    setPrintStatus('printing');
    
    try {
      const receiptData = buildReceiptData();
      const receiptHtml = receiptRef.current?.innerHTML || '';
      
      const result = await printReceipt(receiptData, {
        fallbackToBrowser: true,
        receiptHtml,
      });

      if (result.success) {
        setPrintStatus('success');
        if (result.method === 'thermal') {
          toast.success('Receipt printed successfully!');
        } else if (result.method === 'browser') {
          // Browser print dialog opened
          setPrintStatus('idle');
        }
      } else {
        setPrintStatus('error');
        toast.error(result.error || 'Print failed');
      }
    } catch (error) {
      setPrintStatus('error');
      toast.error(error instanceof Error ? error.message : 'Print failed');
    }
  };

  const _handleBrowserPrint = () => {
    const printContent = receiptRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Could not open print window. Please allow pop-ups.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receiptNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              max-width: 80mm; 
              margin: 0 auto; 
              padding: 5mm;
              line-height: 1.3;
            }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .total { font-weight: bold; font-size: 14px; }
            .center { text-align: center; }
            .text-xs { font-size: 10px; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleShare = async () => {
    const text = `
Receipt: ${receiptNumber}
Date: ${date}
${branchName ? `Branch: ${branchName}` : ''}
${branchAddress ? `Address: ${branchAddress}` : ''}
${customerName ? `Customer: ${customerName}` : ''}
---
${items.map(item => `${item.name} x${item.quantity} = KES ${item.total.toLocaleString()}`).join('\n')}
---
Total: KES ${total.toLocaleString()}
${payments.map(p => `${p.method.toUpperCase()}: KES ${p.amount.toLocaleString()}`).join('\n')}
---
${footerMessage}
    `.trim();

    if (navigator.share) {
      await navigator.share({ title: `Receipt ${receiptNumber}`, text });
    } else {
      const encodedText = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
  };

  const _capabilities = getPrinterCapabilities();
  const printerInfo = defaultPrinter 
    ? `${defaultPrinter.name} (${defaultPrinter.connection_type})`
    : 'No printer configured';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-500" />
            Sale Complete
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview - Matches ReceiptPreview.tsx styling exactly */}
        <div 
          ref={receiptRef}
          className="mx-4 bg-white text-black rounded-xl p-4 font-mono text-xs max-h-[400px] overflow-y-auto"
        >
          {/* Header Section */}
          <div className="text-center space-y-0.5">
            <p className="font-bold text-sm">DukaOS</p>
            {branchName && <p className="text-[10px]">{branchName}</p>}
            {branchAddress && <p className="text-[10px]">{branchAddress}</p>}
            {branchCity && <p className="text-[10px]">{branchCity}</p>}
            {branchPhone && <p className="text-[10px]">Tel: {branchPhone}</p>}
          </div>

          {/* Payment Info - Till, Paybill, KRA */}
          {(mpesaTill || mpesaPaybill || kraPin) && (
            <>
              <Separator className="border-dashed my-2" />
              <div className="text-center space-y-0.5">
                {mpesaTill && (
                  <p className="text-[10px]">Till: {mpesaTill}</p>
                )}
                {mpesaPaybill && (
                  <p className="text-[10px]">
                    Paybill: {mpesaPaybill}
                    {mpesaAccount && ` A/C: ${mpesaAccount}`}
                  </p>
                )}
                {kraPin && (
                  <p className="text-[10px]">KRA PIN: {kraPin}</p>
                )}
              </div>
            </>
          )}

          <Separator className="border-dashed my-2" />

          {/* Receipt Details */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span>{receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{date}</span>
            </div>
            {cashierName && (
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{cashierName}</span>
              </div>
            )}
            {customerName && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{customerName}</span>
              </div>
            )}
          </div>

          <Separator className="border-dashed my-2" />

          {/* Items Header */}
          <div className="flex justify-between font-bold text-[10px]">
            <span>ITEM</span>
            <span>AMOUNT</span>
          </div>

          {/* Items */}
          <div className="space-y-1 mt-1">
            {items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="flex-1 truncate pr-2">{item.name}</span>
                  <span>KSh {item.total.toLocaleString()}</span>
                </div>
                <div className="text-[9px] text-muted-foreground flex justify-between">
                  <span>{item.quantity} x {item.unit_price.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <Separator className="border-dashed my-2" />

          {/* Totals */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>KSh {subtotal.toLocaleString()}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>KSh {tax.toLocaleString()}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-KSh {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-dashed pt-1">
              <span>TOTAL:</span>
              <span>KSh {total.toLocaleString()}</span>
            </div>
          </div>

          <Separator className="border-dashed my-2" />

          {/* Payments */}
          <div className="space-y-0.5">
            {payments.map((payment, i) => (
              <div key={i} className="flex justify-between">
                <span className="uppercase">{payment.method}</span>
                <span>KSh {payment.amount.toLocaleString()}</span>
              </div>
            ))}
            {typeof cashReceived === 'number' && cashReceived > 0 && (
              <div className="flex justify-between">
                <span>Cash Received:</span>
                <span>KSh {cashReceived.toLocaleString()}</span>
              </div>
            )}
            {typeof changeGiven === 'number' && changeGiven > 0 && (
              <div className="flex justify-between font-bold">
                <span>Change:</span>
                <span>KSh {changeGiven.toLocaleString()}</span>
              </div>
            )}
            {payments.some(p => p.mpesa_reference) && (
              <p className="text-[9px] text-muted-foreground">
                Ref: {payments.find(p => p.mpesa_reference)?.mpesa_reference}
              </p>
            )}
          </div>

          {/* Footer Message */}
          <Separator className="border-dashed my-2" />
          <div className="text-center">
            <p className="text-[10px]">{footerMessage}</p>
          </div>

          {/* Barcode */}
          <div className="text-center pt-2">
            <svg ref={barcodeRef} className="mx-auto" />
          </div>
        </div>

        {/* Printer Status */}
        <div className="mx-4 text-xs text-muted-foreground flex items-center gap-2">
          {hasPrinter ? (
            <>
              <Printer className="w-3 h-3" />
              <span>{printerInfo}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              <span>No thermal printer - will use browser print</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 pt-2">
          <Button 
            variant="outline" 
            onClick={handlePrint} 
            className="flex-1 gap-2"
            disabled={isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
          ) : printStatus === 'success' ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
              <Printer className="w-4 h-4" />
            )}
            {isPrinting ? 'Printing...' : printStatus === 'success' ? 'Printed!' : 'Print Receipt'}
          </Button>
          <Button variant="outline" onClick={handleShare} className="flex-1 gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button onClick={onClose} className="flex-1">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptModal;
