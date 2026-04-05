import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Banknote, Smartphone, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Payment {
  method: 'cash' | 'mpesa' | 'card' | 'credit';
  amount: number;
  mpesa_reference?: string;
  mpesa_phone?: string;
  customer_id?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirmPayment: (payments: Payment[]) => void;
}

const quickAmounts = [50, 100, 200, 500, 1000, 2000, 5000];

const PaymentModal = ({ isOpen, onClose, total, onConfirmPayment }: PaymentModalProps) => {
  const [method, setMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [cashAmount, setCashAmount] = useState(total);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaReference, setMpesaReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCashAmount(total);
      setMpesaPhone('');
      setMpesaReference('');
      setMethod('cash');
      setIsProcessing(false);
    }
  }, [isOpen, total]);

  const change = Math.max(0, cashAmount - total);

  const handleConfirm = async () => {
    if (isProcessing) return;
    if (total <= 0) { toast.error('Invalid amount'); return; }

    const payments: Payment[] = [];

    if (method === 'cash') {
      if (cashAmount < total) { toast.error('Insufficient cash'); return; }
      payments.push({ method: 'cash', amount: total });
    } else if (method === 'mpesa') {
      const phoneClean = mpesaPhone.replace(/\s/g, '');
      if (!phoneClean) { toast.error('Enter phone number'); return; }
      if (!/^(07|01|\+254|254)\d{8,9}$/.test(phoneClean)) { toast.error('Invalid phone format'); return; }
      if (!mpesaReference.trim()) { toast.error('Enter M-Pesa reference'); return; }
      payments.push({
        method: 'mpesa',
        amount: total,
        mpesa_phone: phoneClean,
        mpesa_reference: mpesaReference.trim().toUpperCase(),
      });
    } else if (method === 'card') {
      payments.push({ method: 'card', amount: total });
    }

    setIsProcessing(true);
    try {
      await onConfirmPayment(payments);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Total banner */}
        <div className="bg-primary text-primary-foreground p-5 text-center">
          <p className="text-xs opacity-80 uppercase tracking-wider">Total to Pay</p>
          <p className="text-4xl font-black tabular-nums mt-1">KES {total.toLocaleString()}</p>
        </div>

        {/* 3 Payment method buttons */}
        <div className="grid grid-cols-3 border-b border-border">
          {[
            { id: 'cash' as const, icon: Banknote, label: 'Cash' },
            { id: 'mpesa' as const, icon: Smartphone, label: 'M-Pesa' },
            { id: 'card' as const, icon: CreditCard, label: 'Card' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setMethod(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-4 text-sm font-medium transition-colors border-b-2',
                method === id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-6 h-6" />
              {label}
            </button>
          ))}
        </div>

        {/* Payment form */}
        <div className="p-4 space-y-4">
          {method === 'cash' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Cash Received</Label>
                <Input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                  className="text-xl font-bold h-12 mt-1"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setCashAmount(amt)}
                    className="px-3 py-1.5 rounded-md bg-secondary text-xs font-medium hover:bg-secondary/80"
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
                <button
                  onClick={() => setCashAmount(total)}
                  className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold"
                >
                  Exact
                </button>
              </div>
              {change > 0 && (
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className="text-2xl font-black text-success tabular-nums">
                    KES {change.toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )}

          {method === 'mpesa' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Customer Phone</Label>
                <Input
                  type="tel"
                  placeholder="0712345678"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  className="h-12 text-lg mt-1"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">M-Pesa Reference Code</Label>
                <Input
                  placeholder="e.g. RKX7HG89TY"
                  value={mpesaReference}
                  onChange={(e) => setMpesaReference(e.target.value.toUpperCase())}
                  className="h-12 text-lg font-mono mt-1"
                />
              </div>
            </>
          )}

          {method === 'card' && (
            <div className="bg-secondary/50 rounded-lg p-6 text-center">
              <CreditCard className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Process on POS terminal</p>
              <p className="text-xl font-bold mt-1 tabular-nums">KES {total.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 p-4 pt-0">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12" disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-[2] h-12 text-base font-bold"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Complete Sale'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
