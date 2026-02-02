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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { CreditCard, Wallet, Smartphone, Building } from 'lucide-react';

interface CreditPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    name: string;
    credit_balance: number;
    credit_limit: number;
  } | null;
}

const CreditPaymentDialog = ({ isOpen, onClose, customer }: CreditPaymentDialogProps) => {
  const { recordPayment } = useCustomerCredit();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !amount) return;

    await recordPayment.mutateAsync({
      customerId: customer.id,
      amount: parseFloat(amount),
      paymentMethod,
      reference: reference || undefined,
      notes: notes || undefined,
    });

    setAmount('');
    setPaymentMethod('cash');
    setReference('');
    setNotes('');
    onClose();
  };

  if (!customer) return null;

  const maxPayment = customer.credit_balance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Record a payment against {customer.name}'s outstanding balance.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-secondary/50 rounded-lg p-3 my-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Outstanding Balance</span>
            <span className="font-bold text-destructive tabular-nums">
              KES {customer.credit_balance.toLocaleString()}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              max={maxPayment}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-mono"
              required
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount((maxPayment / 2).toFixed(2))}
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(maxPayment.toFixed(2))}
              >
                Full Balance
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Cash
                  </div>
                </SelectItem>
                <SelectItem value="mpesa">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    M-Pesa
                  </div>
                </SelectItem>
                <SelectItem value="bank">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Bank Transfer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod !== 'cash' && (
            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={paymentMethod === 'mpesa' ? 'M-Pesa code' : 'Transaction reference'}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={recordPayment.isPending || !amount || parseFloat(amount) <= 0}
              className="flex-1"
            >
              {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreditPaymentDialog;
