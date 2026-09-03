import { useEffect, useState } from 'react';
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
import { RotateCcw, Search, Package, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import ManagerApprovalDialog from '@/components/auth/ManagerApprovalDialog';

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
  /** When provided, skip the search step and auto-load this sale. */
  preloadedSaleId?: string | null;
  /** When true, prefill each item's returnQuantity with its full quantity (full refund flow). */
  preloadFullRefund?: boolean;
}

const ReturnModal = ({ isOpen, onClose, onComplete, preloadedSaleId, preloadFullRefund }: ReturnModalProps) => {
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const { canProcessRefunds, isManager } = usePermissions();
  const { log } = useAuditLog();
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
  
  // Manager approval state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [_pendingApproval, setPendingApproval] = useState(false);
  const [_approverInfo, setApproverInfo] = useState<{ id: string; email: string; role: string } | null>(null);

  const handleSearch = async () => {
    if (!receiptNumber.trim()) return;
    if (!currentBranch?.id) {
      toast.error('Please select a branch');
      return;
    }
    
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

  const loadSaleById = async (saleId: string, prefillFull: boolean) => {
    setSearching(true);
    try {
      const { data: sale, error } = await supabase
        .from('sales')
        .select('id, receipt_number, total_amount, created_at')
        .eq('id', saleId)
        .single();
      if (error || !sale) {
        toast.error('Sale not found');
        return;
      }
      const { data: items } = await supabase
        .from('sale_items')
        .select('id, product_id, product_name, quantity, unit_price, total_amount')
        .eq('sale_id', sale.id);
      setReceiptNumber(sale.receipt_number);
      setSaleData({
        ...sale,
        items: (items || []).map(item => ({
          ...item,
          returnQuantity: prefillFull ? item.quantity : 0,
        })),
      });
    } catch (err) {
      console.error('Preload error:', err);
      toast.error('Failed to load sale');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen && preloadedSaleId) {
      loadSaleById(preloadedSaleId, !!preloadFullRefund);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preloadedSaleId, preloadFullRefund]);

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

  const handleRequestApproval = () => {
    if (!saleData || returnItems.length === 0 || !reason.trim()) {
      toast.error('Please select items to return and provide a reason');
      return;
    }
    setShowApprovalDialog(true);
  };

  const handleApprovalGranted = (info: ManagerApproval) => {
    setApproverInfo(info);
    setPendingApproval(true);
    // Auto-process after approval
    processReturn(info);
  };

  // One idempotency key per refund attempt for a given sale. A network retry of the
  // same attempt is recognised by the server and cannot restore stock twice.
  const idempotencyKeyRef = useRef<{ saleId: string; key: string } | null>(null);
  const getIdempotencyKey = (saleId: string) => {
    if (!idempotencyKeyRef.current || idempotencyKeyRef.current.saleId !== saleId) {
      idempotencyKeyRef.current = { saleId, key: crypto.randomUUID() };
    }
    return idempotencyKeyRef.current.key;
  };

  const processReturn = async (approver?: ManagerApproval) => {
    const branchId = currentBranch?.id;
    if (!branchId || !user?.id) {
      toast.error('Please select a branch');
      return;
    }

    if (!saleData || returnItems.length === 0 || !reason.trim()) {
      toast.error('Please select items to return and provide a reason');
      return;
    }

    if (!canProcessRefunds && !isManager && !approver?.approvalId) {
      toast.error('Manager approval is required to process this refund');
      return;
    }

    setProcessing(true);
    try {
      // Single atomic server-side operation: return + line items + stock restoration +
      // audit trail. Server enforces authorization, over-refund and duplicate protection.
      const { data, error } = await supabase.rpc('process_return', {
        p_sale_id: saleData.id,
        p_items: returnItems.map(item => ({ sale_item_id: item.id, quantity: item.returnQuantity })),
        p_reason: reason.trim(),
        p_refund_method: refundMethod,
        p_idempotency_key: getIdempotencyKey(saleData.id),
        p_approval_request_id: approver?.approvalId ?? undefined,
      });

      if (error) throw error;

      const result = data as { return_id: string; refund_amount: number; status: string };
      idempotencyKeyRef.current = null;

      if (result.status === 'already_processed') {
        toast.info('This return was already processed');
      } else {
        toast.success(`Return processed. Refund: KES ${Number(result.refund_amount).toLocaleString()}`);
      }
      handleClose();
      onComplete();
    } catch (error: any) {
      console.error('Return error:', error);
      toast.error(error?.message || 'Failed to process return');
    } finally {
      setProcessing(false);
      setPendingApproval(false);
    }
  };

  const handleProcessReturn = async () => {
    // Check if user needs manager approval
    if (!canProcessRefunds && !isManager) {
      handleRequestApproval();
      return;
    }
    
    // Manager can process directly
    await processReturn();
  };

  const handleClose = () => {
    setReceiptNumber('');
    setSaleData(null);
    setReason('');
    setRefundMethod('cash');
    setApproverInfo(null);
    setPendingApproval(false);
    onClose();
  };

  return (
    <>
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

                {/* Manager approval notice for cashiers */}
                {!canProcessRefunds && !isManager && (
                  <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                    <Shield className="w-4 h-4 text-warning" />
                    <span>Manager approval required to process returns</span>
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
              {processing ? 'Processing...' : (
                !canProcessRefunds && !isManager ? (
                  <>
                    <Shield className="w-4 h-4 mr-1" />
                    Request Approval
                  </>
                ) : (
                  'Process Return'
                )
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManagerApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => setShowApprovalDialog(false)}
        onApprove={handleApprovalGranted}
        actionType="Process Refund"
        actionDescription={`Refund KES ${totalRefund.toLocaleString()} for ${returnItems.length} item(s) from receipt ${saleData?.receipt_number || ''}`}
        entityId={saleData?.id}
        entityType="return"
      />
    </>
  );
};

export default ReturnModal;
