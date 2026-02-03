import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, XCircle, Shield } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLog } from '@/hooks/useAuditLog';
import ManagerApprovalDialog from '@/components/auth/ManagerApprovalDialog';

interface VoidSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, approver?: { id: string; email: string }) => void;
  itemCount: number;
  total: number;
}

const VoidSaleModal = ({ isOpen, onClose, onConfirm, itemCount, total }: VoidSaleModalProps) => {
  const [reason, setReason] = useState('');
  const { canVoidSales, isManager } = usePermissions();
  const { log } = useAuditLog();
  
  // Manager approval state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  const handleRequestApproval = () => {
    if (!reason.trim()) {
      return;
    }
    setShowApprovalDialog(true);
  };

  const handleApprovalGranted = (approverInfo: { id: string; email: string; role: string }) => {
    // Log the void with approval
    log('SALE_VOIDED', 'sale', undefined, undefined, {
      item_count: itemCount,
      total_amount: total,
      reason,
      approved_by: approverInfo.id,
      approver_email: approverInfo.email,
    });
    
    onConfirm(reason, { id: approverInfo.id, email: approverInfo.email });
    setReason('');
    onClose();
  };

  const handleConfirm = () => {
    if (!reason.trim()) return;
    
    // Check if user needs manager approval
    if (!canVoidSales && !isManager) {
      handleRequestApproval();
      return;
    }
    
    // Manager can void directly
    log('SALE_VOIDED', 'sale', undefined, undefined, {
      item_count: itemCount,
      total_amount: total,
      reason,
    });
    
    onConfirm(reason);
    setReason('');
    onClose();
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Void Current Sale
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">This action cannot be undone</p>
                <p className="text-muted-foreground mt-1">
                  You are about to void a sale with {itemCount} item{itemCount !== 1 ? 's' : ''} totaling{' '}
                  <span className="font-semibold">KES {total.toLocaleString()}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason for voiding *</Label>
              <Textarea
                id="void-reason"
                placeholder="Enter the reason for voiding this sale..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Manager approval notice for cashiers */}
            {!canVoidSales && !isManager && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                <Shield className="w-4 h-4 text-warning" />
                <span>Manager approval required to void sales</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!reason.trim()}
            >
              {!canVoidSales && !isManager ? (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Request Approval
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Void Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManagerApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => setShowApprovalDialog(false)}
        onApprove={handleApprovalGranted}
        actionType="Void Sale"
        actionDescription={`Void sale with ${itemCount} item(s) totaling KES ${total.toLocaleString()}`}
        entityType="sale"
      />
    </>
  );
};

export default VoidSaleModal;
