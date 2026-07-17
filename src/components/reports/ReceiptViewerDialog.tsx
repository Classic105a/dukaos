import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Share2, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/hooks/useBranch';
import { usePrinter } from '@/hooks/usePrinter';
import { buildReprintPayload, type ReprintPayload } from '@/lib/reprint-receipt';

interface ReceiptViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string | null;
  /** When true, render receipt HTML with a REPRINT banner treatment. */
  markAsReprint?: boolean;
}

/**
 * Read-only receipt preview. Never mutates sales, inventory, or payments.
 * Offers: Reprint (thermal), Print (browser), Download PDF, Share.
 */
const ReceiptViewerDialog = ({ isOpen, onClose, saleId, markAsReprint = false }: ReceiptViewerDialogProps) => {
  const { currentBranch } = useBranch();
  const { printReceipt, isPrinting: printerBusy } = usePrinter();
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ReprintPayload | null>(null);
  const [reprinting, setReprinting] = useState(false);

  useEffect(() => {
    if (!isOpen || !saleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await buildReprintPayload(saleId, currentBranch);
        if (!cancelled) setPayload(p);
      } catch (err) {
        console.error('Load receipt error:', err);
        toast.error('Failed to load receipt');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, saleId, currentBranch]);

  const html = payload?.receiptHtml || '';

  const handleReprint = async () => {
    if (!payload) return;
    setReprinting(true);
    try {
      const result = await printReceipt(payload.receiptData, {
        fallbackToBrowser: true,
        receiptHtml: payload.receiptHtml,
      });
      if (result.success) {
        if (result.method === 'thermal') toast.success('Receipt reprinted');
      } else {
        toast.error(result.error || 'Failed to reprint');
      }
    } finally {
      setReprinting(false);
    }
  };

  const handleBrowserPrint = () => {
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${payload?.receiptData.receiptNumber || ''}</title></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleDownloadPdf = () => {
    // Same open-and-print path — user chooses "Save as PDF" from the print dialog.
    handleBrowserPrint();
  };

  const handleShare = async () => {
    if (!payload) return;
    const r = payload.receiptData;
    const text = [
      `Receipt ${r.receiptNumber}`,
      `Date: ${r.date.toLocaleString()}`,
      `Total: KES ${Number(r.totalAmount).toLocaleString()}`,
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: `Receipt ${r.receiptNumber}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Receipt summary copied to clipboard');
      }
    } catch (err) {
      // User cancelled or share unavailable — ignore silently
      if ((err as any)?.name !== 'AbortError') console.warn('Share failed', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Receipt Preview
            {markAsReprint && (
              <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                REPRINTED COPY
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-white text-black rounded-md p-3 max-h-[55vh] overflow-y-auto border">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No receipt to display</p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleBrowserPrint} disabled={!html}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={!html}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} disabled={!html}>
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
            <Button size="sm" onClick={handleReprint} disabled={!payload || reprinting || printerBusy}>
              {reprinting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Printer className="w-4 h-4 mr-1" />}
              Reprint
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptViewerDialog;