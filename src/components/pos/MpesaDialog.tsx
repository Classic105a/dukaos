import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smartphone, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MpesaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (phone: string, reference: string) => void;
}

type MpesaStatus = 'input' | 'waiting' | 'success' | 'failed';

const MpesaDialog = ({ isOpen, onClose, total, onComplete }: MpesaDialogProps) => {
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState<MpesaStatus>('input');

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setReference('');
      setStatus('input');
    }
  }, [isOpen]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('254')) return '+' + digits;
    if (digits.startsWith('0')) return digits;
    return digits;
  };

  const handleSendSTK = () => {
    const clean = phone.replace(/\s/g, '');
    if (!/^(07|01|\+254|254)\d{8,9}$/.test(clean)) {
      toast.error('Invalid phone number');
      return;
    }
    setStatus('waiting');
    // Simulate STK push — in production, call edge function here
    // For now, show waiting state and let cashier enter reference manually
  };

  const handleConfirm = () => {
    if (!reference.trim()) {
      toast.error('Enter M-Pesa reference code');
      return;
    }
    const clean = phone.replace(/\s/g, '');
    onComplete(clean, reference.trim().toUpperCase());
  };

  const handleRetry = () => {
    setStatus('input');
    setReference('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-[#4caf50] text-white p-4 text-center">
          <Smartphone className="w-8 h-8 mx-auto mb-1" />
          <p className="text-xs opacity-80 uppercase">M-Pesa Payment</p>
          <p className="text-3xl font-black tabular-nums mt-1">KES {total.toLocaleString()}</p>
        </div>

        <div className="p-4 space-y-4">
          {status === 'input' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="h-12 text-lg mt-1"
                  autoFocus
                />
              </div>
              <Button
                onClick={handleSendSTK}
                className="w-full h-12 text-base font-bold bg-[#4caf50] hover:bg-[#43a047] text-white"
                disabled={phone.replace(/\D/g, '').length < 10}
              >
                Send STK Push
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Customer will receive a payment prompt on their phone
              </p>
            </>
          )}

          {status === 'waiting' && (
            <>
              <div className="text-center py-4">
                <Loader2 className="w-10 h-10 animate-spin text-[#4caf50] mx-auto mb-3" />
                <p className="font-medium">Waiting for payment...</p>
                <p className="text-xs text-muted-foreground mt-1">STK Push sent to {phone}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">M-Pesa Reference (from SMS)</label>
                <Input
                  placeholder="e.g. RKX7HG89TY"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  className="h-12 text-lg font-mono mt-1"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRetry} className="flex-1 h-11">
                  Retry
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-[2] h-11 bg-[#4caf50] hover:bg-[#43a047] text-white font-bold"
                  disabled={!reference.trim()}
                >
                  Confirm Payment
                </Button>
              </div>
            </>
          )}

          {status === 'failed' && (
            <div className="text-center py-6">
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <p className="font-bold text-destructive">Payment Failed</p>
              <p className="text-sm text-muted-foreground mt-1">Please try again</p>
              <Button onClick={handleRetry} className="mt-4 w-full h-11">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MpesaDialog;
