import { useState } from 'react';
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
import { useShift } from '@/hooks/useShift';
import { Clock, Wallet, ArrowRight } from 'lucide-react';

interface OpenShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const OpenShiftDialog = ({ isOpen, onClose }: OpenShiftDialogProps) => {
  const { openShift } = useShift();
  const [openingFloat, setOpeningFloat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await openShift(parseFloat(openingFloat) || 0);
      setOpeningFloat('');
      onClose();
    } catch (error) {
      // Error handled by the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Start New Shift
          </DialogTitle>
          <DialogDescription>
            Enter your opening cash float to begin your shift.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="openingFloat" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Opening Float (KES)
            </Label>
            <Input
              id="openingFloat"
              type="number"
              min="0"
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="0.00"
              className="text-lg font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Count the cash in your drawer and enter the total amount
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Starting...' : (
                <>
                  Start Shift
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OpenShiftDialog;
