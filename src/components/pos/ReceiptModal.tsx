import { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Check } from 'lucide-react';
import type { CartItem } from './Cart';
import JsBarcode from 'jsbarcode';

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
  branchName?: string;
  customerName?: string;
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
  customerName
}: ReceiptModalProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const date = new Date().toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // Generate barcode when receipt number changes
  useEffect(() => {
    if (barcodeRef.current && receiptNumber) {
      try {
        JsBarcode(barcodeRef.current, receiptNumber.replace(/[^A-Z0-9]/gi, ''), {
          format: 'CODE128',
          width: 1.5,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 5,
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [receiptNumber, isOpen]);

  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receiptNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .total { font-weight: bold; font-size: 14px; }
            .center { text-align: center; }
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
${customerName ? `Customer: ${customerName}` : ''}
---
${items.map(item => `${item.name} x${item.quantity} = KES ${item.total.toLocaleString()}`).join('\n')}
---
Total: KES ${total.toLocaleString()}
${payments.map(p => `${p.method.toUpperCase()}: KES ${p.amount.toLocaleString()}`).join('\n')}
---
Thank you for shopping with us!
    `.trim();

    if (navigator.share) {
      await navigator.share({ title: `Receipt ${receiptNumber}`, text });
    } else {
      // Fallback to WhatsApp
      const encodedText = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-success" />
            Sale Complete
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div 
          ref={receiptRef}
          className="bg-white text-black rounded-xl p-4 font-mono text-sm max-h-[400px] overflow-y-auto"
        >
          <div className="header text-center mb-4">
            <h2 className="font-bold text-lg">DukaOS</h2>
            {branchName && <p>{branchName}</p>}
            <p className="text-xs opacity-70">{date}</p>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          <p className="text-center text-xs mb-2">Receipt: {receiptNumber}</p>
          {customerName && <p className="text-center text-xs mb-2">Customer: {customerName}</p>}

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          {/* Items */}
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span className="truncate flex-1">{item.name}</span>
                </div>
                <div className="flex justify-between text-xs opacity-70">
                  <span>{item.quantity} x {item.unit_price.toLocaleString()}</span>
                  <span>{item.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="row flex justify-between">
              <span>Subtotal</span>
              <span>{subtotal.toLocaleString()}</span>
            </div>
            {tax > 0 && (
              <div className="row flex justify-between">
                <span>Tax</span>
                <span>{tax.toLocaleString()}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="row flex justify-between">
                <span>Discount</span>
                <span>-{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="row flex justify-between font-bold text-base pt-1 border-t border-gray-300">
              <span>TOTAL</span>
              <span>KES {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          {/* Payments */}
          <div className="space-y-1">
            {payments.map((payment, i) => (
              <div key={i} className="row flex justify-between">
                <span className="uppercase">{payment.method}</span>
                <span>{payment.amount.toLocaleString()}</span>
              </div>
            ))}
            {payments.some(p => p.mpesa_reference) && (
              <p className="text-xs opacity-70">
                Ref: {payments.find(p => p.mpesa_reference)?.mpesa_reference}
              </p>
            )}
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          {/* Barcode */}
          <div className="text-center">
            <svg ref={barcodeRef} className="mx-auto" />
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          <div className="center text-center text-xs">
            <p>Thank you for shopping with us!</p>
            {cashierName && <p className="opacity-70">Served by: {cashierName}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex-1 gap-2">
            <Printer className="w-4 h-4" />
            Print
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
