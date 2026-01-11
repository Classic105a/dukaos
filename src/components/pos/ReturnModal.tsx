import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RotateCcw, Search, Package, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { toast } from 'sonner';

interface ReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  returnQuantity: number;
}

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ReturnModal = ({ isOpen, onClose, onComplete }: ReturnModalProps) => {
  const { currentBranch } = useBranch();
  const [receiptNumber, setReceiptNumber] = useState('');
  const [saleData, setSaleData] = useState<{
    id: string;
    receipt_number: string;
    total_amount: number;
    created_at: string;
    items: ReturnItem[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'mpesa' | 'store_credit'>('cash');
  const [processing, setProcessing] = useState(false);

  const handleSearch = async () => {
    if (!receiptNumber.trim()) return;
    
    setSearching(true);
    try {
      const { data: sale, error } = await supabase
        .from('sales')
        .select('id, receipt_number, total_amount, created_at')
        .eq('receipt_number', receiptNumber.trim().toUpperCase())
        .eq('branch_id', currentBranch?.id)
        .single();

      if (error || !sale) {
        toast.error('Receipt not found');
        setSaleData(null);
        return;
      }

      const { data: items } = await supabase
        .from('sale_items')
        .select('id, product_id, product_name, quantity, unit_price, total_amount')
        .eq('sale_id', sale.id);

      setSaleData({
        ...sale,
        items: (items || []).map(item => ({
          ...item,
          returnQuantity: 0,
        })),
      });
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search receipt');
    } finally {
      setSearching(false);
    }
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (!saleData) return;
    
    setSaleData(prev => ({
      ...prev!,
      items: prev!.items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            returnQuantity: Math.min(Math.max(0, quantity), item.quantity),
          };
        }
        return item;
      }),
    }));
  };

  const returnItems = saleData?.items.filter(i => i.returnQuantity > 0) || [];
  const totalRefund = returnItems.reduce(
    (sum, item) => sum + item.unit_price * item.returnQuantity,
    0
  );

  const handleProcessReturn = async () => {
    if (!saleData || returnItems.length === 0 || !reason.trim()) {
      toast.error('Please select items to return and provide a reason');
      return;
    }

    setProcessing(true);
    try {
      // Create return record
      const { error: returnError } = await supabase
        .from('returns')
        .insert({
          original_sale_id: saleData.id,
          branch_id: currentBranch?.id,
          reason,
          refund_method: refundMethod,
          refund_amount: totalRefund,
          status: 'completed',
        });

      if (returnError) throw returnError;

      // Restore inventory for returned items
      for (const item of returnItems) {
        const { data: inventory } = await supabase
          .from('branch_inventory')
          .select('id, quantity')
          .eq('branch_id', currentBranch?.id)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (inventory) {
          await supabase
            .from('branch_inventory')
            .update({ quantity: inventory.quantity + item.returnQuantity })
            .eq('id', inventory.id);
        }
      }

      toast.success(`Return processed. Refund: KES ${totalRefund.toLocaleString()}`);
      handleClose();
      onComplete();
    } catch (error) {
      console.error('Return error:', error);
      toast.error('Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setReceiptNumber('');
    setSaleData(null);
    setReason('');
    setRefundMethod('cash');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Process Return
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Receipt Search */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter receipt number (e.g., RCP-ABC123)"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Sale Details */}
          {saleData && (
            <>
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt:</span>
                  <span className="font-medium">{saleData.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{new Date(saleData.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Total:</span>
                  <span className="font-medium">KES {Number(saleData.total_amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Items to Return */}
              <div className="space-y-2">
                <Label>Select items to return</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {saleData.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            KES {item.unit_price} × {item.quantity} sold
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Return:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={item.returnQuantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-center"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="return-reason">Reason for return *</Label>
                <Textarea
                  id="return-reason"
                  placeholder="Enter the reason for this return..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Refund Method */}
              <div className="space-y-2">
                <Label>Refund method</Label>
                <RadioGroup
                  value={refundMethod}
                  onValueChange={(v) => setRefundMethod(v as any)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="cursor-pointer">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mpesa" id="mpesa" />
                    <Label htmlFor="mpesa" className="cursor-pointer">M-Pesa</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="store_credit" id="store_credit" />
                    <Label htmlFor="store_credit" className="cursor-pointer">Store Credit</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Refund Total */}
              {totalRefund > 0 && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Refund:</span>
                    <span className="text-xl font-bold text-accent">
                      KES {totalRefund.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {!saleData && !searching && (
            <div className="flex items-center gap-2 p-4 text-muted-foreground text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              Enter a receipt number to find the sale
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleProcessReturn}
            disabled={!saleData || returnItems.length === 0 || !reason.trim() || processing}
          >
            {processing ? 'Processing...' : 'Process Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnModal;
