import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Banknote, Smartphone, CreditCard, Split } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
  method: 'cash' | 'mpesa' | 'card' | 'credit';
  amount: number;
  mpesa_reference?: string;
  mpesa_phone?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirmPayment: (payments: Payment[]) => void;
}

const quickAmounts = [50, 100, 200, 500, 1000, 2000, 5000];

const PaymentModal = ({ isOpen, onClose, total, onConfirmPayment }: PaymentModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState(total);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaReference, setMpesaReference] = useState('');
  const [splitCash, setSplitCash] = useState(0);
  const [splitMpesa, setSplitMpesa] = useState(0);

  const change = cashAmount - total;

  const handleConfirm = () => {
    const payments: Payment[] = [];

    if (paymentMethod === 'cash') {
      if (cashAmount < total) {
        toast.error('Cash amount is less than total');
        return;
      }
      payments.push({ method: 'cash', amount: total });
    } else if (paymentMethod === 'mpesa') {
      if (!mpesaPhone || !mpesaReference) {
        toast.error('Please enter M-Pesa phone and reference');
        return;
      }
      payments.push({ 
        method: 'mpesa', 
        amount: total,
        mpesa_phone: mpesaPhone,
        mpesa_reference: mpesaReference
      });
    } else if (paymentMethod === 'card') {
      payments.push({ method: 'card', amount: total });
    } else if (paymentMethod === 'split') {
      if (splitCash + splitMpesa < total) {
        toast.error('Split amounts must equal or exceed total');
        return;
      }
      if (splitCash > 0) {
        payments.push({ method: 'cash', amount: splitCash });
      }
      if (splitMpesa > 0) {
        if (!mpesaPhone) {
          toast.error('Please enter M-Pesa phone number');
          return;
        }
        payments.push({ 
          method: 'mpesa', 
          amount: splitMpesa,
          mpesa_phone: mpesaPhone,
          mpesa_reference: mpesaReference || `SPLIT-${Date.now()}`
        });
      }
    }

    onConfirmPayment(payments);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Payment</DialogTitle>
        </DialogHeader>

        <div className="bg-primary/10 rounded-xl p-4 mb-4 text-center">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold text-primary">KES {total.toLocaleString()}</p>
        </div>

        <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="cash" className="gap-1.5">
              <Banknote className="w-4 h-4" />
              <span className="hidden sm:inline">Cash</span>
            </TabsTrigger>
            <TabsTrigger value="mpesa" className="gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">M-Pesa</span>
            </TabsTrigger>
            <TabsTrigger value="card" className="gap-1.5">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Card</span>
            </TabsTrigger>
            <TabsTrigger value="split" className="gap-1.5">
              <Split className="w-4 h-4" />
              <span className="hidden sm:inline">Split</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cash" className="space-y-4 mt-4">
            <div>
              <Label>Cash Received</Label>
              <Input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                className="text-lg font-medium"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map(amount => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setCashAmount(amount)}
                >
                  {amount.toLocaleString()}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCashAmount(total)}
              >
                Exact
              </Button>
            </div>
            {change > 0 && (
              <div className="bg-success/10 rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">Change</p>
                <p className="text-2xl font-bold text-success">KES {change.toLocaleString()}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mpesa" className="space-y-4 mt-4">
            <div>
              <Label>Customer Phone Number</Label>
              <Input
                type="tel"
                placeholder="0712345678"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>M-Pesa Reference (Transaction Code)</Label>
              <Input
                placeholder="e.g. RKX7HG89TY"
                value={mpesaReference}
                onChange={(e) => setMpesaReference(e.target.value.toUpperCase())}
              />
            </div>
            <div className="bg-primary/5 rounded-xl p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Lipa Na M-Pesa</p>
              <p>Till Number: <span className="font-mono font-bold">123456</span></p>
              <p>Amount: <span className="font-bold">KES {total.toLocaleString()}</span></p>
            </div>
          </TabsContent>

          <TabsContent value="card" className="space-y-4 mt-4">
            <div className="bg-muted rounded-xl p-6 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                Process card payment on your POS terminal
              </p>
              <p className="text-2xl font-bold mt-2">KES {total.toLocaleString()}</p>
            </div>
          </TabsContent>

          <TabsContent value="split" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cash Amount</Label>
                <Input
                  type="number"
                  value={splitCash}
                  onChange={(e) => setSplitCash(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>M-Pesa Amount</Label>
                <Input
                  type="number"
                  value={splitMpesa}
                  onChange={(e) => setSplitMpesa(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            {splitMpesa > 0 && (
              <div>
                <Label>M-Pesa Phone</Label>
                <Input
                  type="tel"
                  placeholder="0712345678"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                />
              </div>
            )}
            <div className={cn(
              'rounded-xl p-3 text-center',
              splitCash + splitMpesa >= total ? 'bg-success/10' : 'bg-warning/10'
            )}>
              <p className="text-sm">
                Total: KES {(splitCash + splitMpesa).toLocaleString()} / KES {total.toLocaleString()}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-[2]" size="lg">
            Complete Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
