import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useShift } from '@/hooks/useShift';
import { Clock, Wallet, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, CreditCard, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CloseShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CloseShiftDialog = ({ isOpen, onClose }: CloseShiftDialogProps) => {
  const { currentShift, closeShift, getShiftSummary } = useShift();
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<{
    totalSales: number;
    cashSales: number;
    mpesaSales: number;
    cardSales: number;
    transactionCount: number;
    refundsTotal: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen && currentShift) {
      getShiftSummary().then(setSummary);
    }
  }, [isOpen, currentShift, getShiftSummary]);

  const expectedCash = currentShift && summary
    ? currentShift.opening_float + summary.cashSales - summary.refundsTotal
    : 0;

  const discrepancy = actualCash ? parseFloat(actualCash) - expectedCash : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualCash) return;
    
    setIsSubmitting(true);
    
    try {
      await closeShift(parseFloat(actualCash), notes || undefined);
      setActualCash('');
      setNotes('');
      onClose();
    } catch (error) {
      // Error handled by the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentShift) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Close Shift
          </DialogTitle>
          <DialogDescription>
            Count your cash and close out your shift.
          </DialogDescription>
        </DialogHeader>

        {/* Shift Summary */}
        {summary && (
          <div className="space-y-3 py-2">
            <h4 className="font-medium text-sm text-muted-foreground">Shift Summary</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold tabular-nums">KES {summary.totalSales.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{summary.transactionCount} transactions</p>
              </div>
              
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Opening Float</p>
                <p className="text-lg font-bold tabular-nums">KES {currentShift.opening_float.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded text-sm">
                <Wallet className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Cash</p>
                  <p className="font-medium tabular-nums">KES {summary.cashSales.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded text-sm">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">M-Pesa</p>
                  <p className="font-medium tabular-nums">KES {summary.mpesaSales.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded text-sm">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Card</p>
                  <p className="font-medium tabular-nums">KES {summary.cardSales.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {summary.refundsTotal > 0 && (
              <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded text-sm">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Refunds</p>
                  <p className="font-medium tabular-nums text-red-600">-KES {summary.refundsTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Expected Cash in Drawer</span>
              <span className="text-xl font-bold tabular-nums">KES {expectedCash.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actualCash" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Actual Cash Count (KES)
            </Label>
            <Input
              id="actualCash"
              type="number"
              min="0"
              step="0.01"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              placeholder="Enter your cash count"
              className="text-lg font-mono"
              required
            />
          </div>

          {actualCash && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              discrepancy === 0 ? "bg-green-500/10 text-green-700" :
              discrepancy > 0 ? "bg-blue-500/10 text-blue-700" :
              "bg-red-500/10 text-red-700"
            )}>
              {discrepancy === 0 ? (
                <CheckCircle className="w-5 h-5" />
              ) : discrepancy > 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              <div>
                <p className="font-medium">
                  {discrepancy === 0 ? 'Cash Balanced!' :
                   discrepancy > 0 ? `Overage: +KES ${discrepancy.toLocaleString()}` :
                   `Shortage: -KES ${Math.abs(discrepancy).toLocaleString()}`}
                </p>
                {discrepancy !== 0 && (
                  <p className="text-xs opacity-75">
                    {discrepancy > 0 ? 'More cash than expected' : 'Less cash than expected'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about discrepancies or issues..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !actualCash}
              variant={discrepancy < 0 ? "destructive" : "default"}
              className="flex-1"
            >
              {isSubmitting ? 'Closing...' : 'Close Shift'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CloseShiftDialog;
