import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface ReceiptSettings {
  show_logo: boolean;
  show_business_name: boolean;
  show_branch_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_website: boolean;
  show_mpesa_till: boolean;
  show_mpesa_paybill: boolean;
  show_kra_pin: boolean;
  show_cashier_name: boolean;
  show_customer_name: boolean;
  show_date_time: boolean;
  show_receipt_number: boolean;
  show_item_sku: boolean;
  show_item_tax: boolean;
  show_subtotal: boolean;
  show_total_tax: boolean;
  show_discount: boolean;
  show_footer_message: boolean;
  footer_message: string;
  show_return_policy: boolean;
  return_policy: string | null;
  paper_width: string;
  show_barcode?: boolean;
  show_qr_code?: boolean;
  barcode_type?: 'code128' | 'code39' | 'qrcode';
}

interface BranchDetails {
  name?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  mpesa_till_number?: string | null;
  mpesa_paybill_number?: string | null;
  mpesa_account_number?: string | null;
  kra_pin?: string | null;
  logo_url?: string | null;
}

interface ReceiptPreviewProps {
  settings: ReceiptSettings;
  branchDetails?: BranchDetails | null;
}

// Sample receipt data
const sampleItems = [
  { name: 'Milk 500ml', sku: 'MLK001', qty: 2, price: 65, tax: 10.40 },
  { name: 'Bread Loaf', sku: 'BRD002', qty: 1, price: 55, tax: 8.80 },
  { name: 'Sugar 1kg', sku: 'SGR003', qty: 1, price: 180, tax: 28.80 },
];

export const ReceiptPreview = ({ settings, branchDetails }: ReceiptPreviewProps) => {
  const branch = branchDetails || {};

  const subtotal = sampleItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalTax = sampleItems.reduce((sum, item) => sum + item.tax, 0);
  const discount = 20;
  const total = subtotal + totalTax - discount;

  const paperWidthClass = settings.paper_width === '58mm' ? 'max-w-[220px]' : 'max-w-[300px]';

  return (
    <Card className={`${paperWidthClass} mx-auto bg-white text-black font-mono text-xs`}>
      <CardContent className="p-4 space-y-2">
        {/* Header Section */}
        <div className="text-center space-y-1">
          {settings.show_logo && branch?.logo_url && (
            <div className="flex justify-center mb-2">
              <img 
                src={branch.logo_url} 
                alt="Logo" 
                className="h-12 object-contain"
              />
            </div>
          )}
          {settings.show_logo && !branch?.logo_url && (
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-[8px]">
                LOGO
              </div>
            </div>
          )}
          
          {settings.show_business_name && (
            <p className="font-bold text-sm">SAMPLE BUSINESS</p>
          )}
          
          {settings.show_branch_name && branch?.name && (
            <p className="text-[10px]">{branch.name}</p>
          )}
          
          {settings.show_address && branch?.address && (
            <p className="text-[10px]">{branch.address}</p>
          )}
          
          {settings.show_address && branch?.city && (
            <p className="text-[10px]">{branch.city}</p>
          )}
          
          {settings.show_phone && branch?.phone && (
            <p className="text-[10px]">Tel: {branch.phone}</p>
          )}
          
          {settings.show_email && branch?.email && (
            <p className="text-[10px]">{branch.email}</p>
          )}
          
          {settings.show_website && branch?.website && (
            <p className="text-[10px]">{branch.website}</p>
          )}
        </div>

        {/* Payment Info */}
        {(settings.show_mpesa_till || settings.show_mpesa_paybill || settings.show_kra_pin) && (
          <>
            <Separator className="border-dashed" />
            <div className="text-center space-y-0.5">
              {settings.show_mpesa_till && (
                <p className="text-[10px]">
                  Till: {branch?.mpesa_till_number || '123456'}
                </p>
              )}
              {settings.show_mpesa_paybill && (
                <p className="text-[10px]">
                  Paybill: {branch?.mpesa_paybill_number || '654321'}
                  {branch?.mpesa_account_number && ` A/C: ${branch.mpesa_account_number}`}
                </p>
              )}
              {settings.show_kra_pin && (
                <p className="text-[10px]">
                  KRA PIN: {branch?.kra_pin || 'P00XXXXXXX'}
                </p>
              )}
            </div>
          </>
        )}

        <Separator className="border-dashed" />

        {/* Receipt Details */}
        <div className="space-y-0.5">
          {settings.show_receipt_number && (
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span>RCP-2024-0001</span>
            </div>
          )}
          {settings.show_date_time && (
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
            </div>
          )}
          {settings.show_cashier_name && (
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>John Doe</span>
            </div>
          )}
          {settings.show_customer_name && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>Walk-in</span>
            </div>
          )}
        </div>

        <Separator className="border-dashed" />

        {/* Items */}
        <div className="space-y-1">
          <div className="flex justify-between font-bold text-[10px]">
            <span>ITEM</span>
            <span>AMOUNT</span>
          </div>
          {sampleItems.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="flex-1 truncate pr-2">
                  {item.name}
                </span>
                <span>KSh {(item.price * item.qty).toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-muted-foreground flex justify-between">
                <span>
                  {settings.show_item_sku && `${item.sku} • `}
                  {item.qty} x {item.price.toFixed(2)}
                </span>
                {settings.show_item_tax && <span>Tax: {item.tax.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>

        <Separator className="border-dashed" />

        {/* Totals */}
        <div className="space-y-0.5">
          {settings.show_subtotal && (
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>KSh {subtotal.toFixed(2)}</span>
            </div>
          )}
          {settings.show_total_tax && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>KSh {totalTax.toFixed(2)}</span>
            </div>
          )}
          {settings.show_discount && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-KSh {discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-dashed pt-1">
            <span>TOTAL:</span>
            <span>KSh {total.toFixed(2)}</span>
          </div>
        </div>

        <Separator className="border-dashed" />

        {/* Payment Method */}
        <div className="text-center">
          <p className="text-[10px]">Paid by: M-PESA</p>
          <p className="text-[10px]">Ref: QJK7H8YN4X</p>
        </div>

        {/* Footer */}
        {(settings.show_footer_message || settings.show_return_policy) && (
          <>
            <Separator className="border-dashed" />
            <div className="text-center space-y-1">
              {settings.show_footer_message && settings.footer_message && (
                <p className="text-[10px]">{settings.footer_message}</p>
              )}
              {settings.show_return_policy && settings.return_policy && (
                <p className="text-[9px] text-muted-foreground">{settings.return_policy}</p>
              )}
            </div>
          </>
        )}

        {/* Barcode/QR Code */}
        <ReceiptBarcode 
          receiptNumber="RCP-2024-0001" 
          showBarcode={settings.show_barcode !== false}
          showQrCode={settings.show_qr_code}
          barcodeType={settings.barcode_type || 'code128'}
        />
      </CardContent>
    </Card>
  );
};

// Separate barcode component
const ReceiptBarcode = ({ 
  receiptNumber, 
  showBarcode = true, 
  showQrCode = false,
  barcodeType = 'code128'
}: { 
  receiptNumber: string; 
  showBarcode?: boolean;
  showQrCode?: boolean;
  barcodeType?: 'code128' | 'code39' | 'qrcode';
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (showQrCode || barcodeType === 'qrcode') {
      if (qrRef.current) {
        QRCode.toCanvas(qrRef.current, receiptNumber, {
          width: 80,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
      }
    } else if (showBarcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, receiptNumber.replace(/[^A-Z0-9]/gi, ''), {
          format: barcodeType === 'code39' ? 'CODE39' : 'CODE128',
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
  }, [receiptNumber, showBarcode, showQrCode, barcodeType]);

  if (!showBarcode && !showQrCode) return null;

  return (
    <div className="text-center pt-2">
      {(showQrCode || barcodeType === 'qrcode') ? (
        <canvas ref={qrRef} className="mx-auto" />
      ) : (
        <svg ref={barcodeRef} className="mx-auto" />
      )}
    </div>
  );
};

export { ReceiptBarcode };