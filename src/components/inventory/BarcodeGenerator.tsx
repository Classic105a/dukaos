import { useState, useRef, useEffect, useCallback } from 'react';
import JsBarcode from 'jsbarcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, Download, Barcode } from 'lucide-react';
import { escapeHtml } from '@/lib/html';

interface BarcodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit_price: number;
  }>;
}

const BarcodeGenerator = ({ isOpen, onClose, products }: BarcodeGeneratorProps) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [labelCount, setLabelCount] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [format, setFormat] = useState<'CODE128' | 'EAN13' | 'CODE39'>('CODE128');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const barcodeValue = customCode || selectedProduct?.barcode || selectedProduct?.sku || '';

  const renderBarcode = useCallback(() => {
    if (!canvasRef.current || !barcodeValue) return;
    try {
      JsBarcode(canvasRef.current, barcodeValue, {
        format,
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: '#ffffff',
      });
    } catch {
      // Invalid barcode value for format
    }
  }, [barcodeValue, format]);

  useEffect(() => {
    renderBarcode();
  }, [renderBarcode]);

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labels = Array(labelCount).fill(null).map(() => `
      <div style="display:inline-block;text-align:center;margin:4px;padding:8px;border:1px dashed #ccc;page-break-inside:avoid;">
        ${selectedProduct ? `<div style="font-weight:bold;font-size:11px;margin-bottom:4px;">${escapeHtml(selectedProduct.name)}</div>` : ''}
        <img src="${dataUrl}" style="max-width:200px;height:auto;" />
        ${showPrice && selectedProduct ? `<div style="font-size:12px;font-weight:bold;margin-top:2px;">KES ${escapeHtml(selectedProduct.unit_price.toLocaleString())}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <html><head><title>Barcode Labels</title>
      <style>@media print { body { margin: 0; } @page { size: auto; margin: 5mm; } }</style>
      </head><body style="font-family:sans-serif;">${labels}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `barcode-${barcodeValue}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="w-5 h-5" />
            Barcode Label Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Select Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a product..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Custom Code (optional)</Label>
              <Input
                value={customCode}
                onChange={e => setCustomCode(e.target.value)}
                placeholder="Override barcode value"
              />
            </div>
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={v => setFormat(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">CODE128</SelectItem>
                  <SelectItem value="EAN13">EAN-13</SelectItem>
                  <SelectItem value="CODE39">CODE39</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Number of Labels</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={labelCount}
                onChange={e => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={e => setShowPrice(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Show price on label</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            {selectedProduct && (
              <p className="text-sm font-semibold mb-1">{selectedProduct.name}</p>
            )}
            {barcodeValue ? (
              <canvas ref={canvasRef} />
            ) : (
              <div className="h-20 flex items-center text-muted-foreground text-sm">
                Select a product to generate barcode
              </div>
            )}
            {showPrice && selectedProduct && (
              <p className="text-sm font-bold mt-1">KES {selectedProduct.unit_price.toLocaleString()}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={!barcodeValue} className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print {labelCount > 1 ? `(${labelCount})` : ''}
            </Button>
            <Button onClick={handleDownload} variant="outline" disabled={!barcodeValue}>
              <Download className="w-4 h-4 mr-2" />
              Save PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeGenerator;
