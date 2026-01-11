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
import { AlertTriangle, XCircle } from 'lucide-react';

interface VoidSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  itemCount: number;
  total: number;
}

const VoidSaleModal = ({ isOpen, onClose, onConfirm, itemCount, total }: VoidSaleModalProps) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason('');
    onClose();
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
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
            <XCircle className="w-4 h-4 mr-2" />
            Void Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VoidSaleModal;
