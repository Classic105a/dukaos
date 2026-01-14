import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PauseCircle, User } from 'lucide-react';

interface HoldSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerName?: string) => void;
  itemCount: number;
  total: number;
}

const HoldSaleDialog = ({ isOpen, onClose, onConfirm, itemCount, total }: HoldSaleDialogProps) => {
  const [customerName, setCustomerName] = useState('');

  const handleConfirm = () => {
    onConfirm(customerName.trim() || undefined);
    setCustomerName('');
    onClose();
  };

  const handleClose = () => {
    setCustomerName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-primary" />
            Hold Sale
          </DialogTitle>
          <DialogDescription>
            Park this sale to serve another customer. You can resume it later.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Sale summary */}
          <div className="bg-secondary/50 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">{itemCount} items</p>
              <p className="font-bold text-lg tabular-nums">KES {total.toLocaleString()}</p>
            </div>
            <PauseCircle className="w-10 h-10 text-muted-foreground/40" />
          </div>

          {/* Customer name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="customerName" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Customer Name (optional)
            </Label>
            <Input
              id="customerName"
              placeholder="Enter customer name to identify this sale"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Adding a name helps you quickly identify held sales
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            <PauseCircle className="w-4 h-4 mr-1.5" />
            Hold Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HoldSaleDialog;
