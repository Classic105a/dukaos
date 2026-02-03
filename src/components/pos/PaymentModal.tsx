import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Banknote, Smartphone, CreditCard, Split, Plus, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface Payment {
  method: 'cash' | 'mpesa' | 'card' | 'credit';
  amount: number;
  mpesa_reference?: string;
  mpesa_phone?: string;
}

interface SplitPaymentEntry {
  id: string;
  method: 'cash' | 'mpesa' | 'card';
  amount: number;
  mpesa_phone?: string;
  mpesa_reference?: string;
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
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Split payments state
  const [splitPayments, setSplitPayments] = useState<SplitPaymentEntry[]>([]);
  const [activeSplitMethod, setActiveSplitMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [splitAmount, setSplitAmount] = useState(0);
  const [splitMpesaPhone, setSplitMpesaPhone] = useState('');
  const [splitMpesaRef, setSplitMpesaRef] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCashAmount(total);
      setMpesaPhone('');
      setMpesaReference('');
      setSplitPayments([]);
      setSplitAmount(0);
      setSplitMpesaPhone('');
      setSplitMpesaRef('');
      setPaymentMethod('cash');
      setIsProcessing(false);
    }
  }, [isOpen, total]);

  const change = Math.max(0, cashAmount - total);
  
  // Calculate split payment totals
  const splitTotal = splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const splitRemaining = Math.max(0, total - splitTotal);
  const splitComplete = splitTotal >= total;

  const addSplitPayment = () => {
    if (splitAmount <= 0) {
      toast.error('Please enter an amount');
      return;
    }

    if (activeSplitMethod === 'mpesa' && !splitMpesaPhone.trim()) {
      toast.error('Please enter M-Pesa phone number');
      return;
    }

    const newPayment: SplitPaymentEntry = {
      id: crypto.randomUUID(),
      method: activeSplitMethod,
      amount: splitAmount,
      ...(activeSplitMethod === 'mpesa' && {
        mpesa_phone: splitMpesaPhone.replace(/\s/g, ''),
        mpesa_reference: splitMpesaRef.trim().toUpperCase() || `SPLIT-${Date.now()}`,
      }),
    };

    setSplitPayments(prev => [...prev, newPayment]);
    setSplitAmount(splitRemaining - splitAmount > 0 ? splitRemaining - splitAmount : 0);
    setSplitMpesaPhone('');
    setSplitMpesaRef('');
  };

  const removeSplitPayment = (id: string) => {
    setSplitPayments(prev => prev.filter(p => p.id !== id));
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'mpesa': return <Smartphone className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleConfirm = async () => {
    if (isProcessing) return;
    
    // Validate total is positive
    if (total <= 0) {
      toast.error('Invalid total amount');
      return;
    }
    
    const payments: Payment[] = [];

    if (paymentMethod === 'cash') {
      if (cashAmount < 0) {
        toast.error('Cash amount cannot be negative');
        return;
      }
      if (cashAmount < total) {
        toast.error('Cash amount is less than total');
        return;
      }
      payments.push({ method: 'cash', amount: total });
    } else if (paymentMethod === 'mpesa') {
      if (!mpesaPhone.trim() || !mpesaReference.trim()) {
        toast.error('Please enter M-Pesa phone and reference');
        return;
      }
      // Validate phone format (Kenyan)
      const phoneClean = mpesaPhone.replace(/\s/g, '');
      if (!/^(07|01|\+254|254)\d{8,9}$/.test(phoneClean)) {
        toast.error('Invalid phone number format');
        return;
      }
      payments.push({ 
        method: 'mpesa', 
        amount: total,
        mpesa_phone: phoneClean,
        mpesa_reference: mpesaReference.trim().toUpperCase()
      });
    } else if (paymentMethod === 'card') {
      payments.push({ method: 'card', amount: total });
    } else if (paymentMethod === 'split') {
      if (splitPayments.length === 0) {
        toast.error('Please add at least one payment');
        return;
      }
      if (splitTotal < total) {
        toast.error('Split payments must equal or exceed total');
        return;
      }
      
      // Convert split payments to Payment format
      splitPayments.forEach(sp => {
        payments.push({
          method: sp.method,
          amount: sp.amount,
          ...(sp.mpesa_phone && { mpesa_phone: sp.mpesa_phone }),
          ...(sp.mpesa_reference && { mpesa_reference: sp.mpesa_reference }),
        });
      });
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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
            {/* Added payments */}
            {splitPayments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Added Payments</Label>
                <div className="space-y-2">
                  {splitPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {getMethodIcon(payment.method)}
                        <span className="font-medium capitalize">{payment.method}</span>
                        {payment.mpesa_phone && (
                          <span className="text-xs text-muted-foreground">
                            ({payment.mpesa_phone})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">KES {payment.amount.toLocaleString()}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeSplitPayment(payment.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress indicator */}
            <div className={cn(
              'rounded-xl p-3 text-center',
              splitComplete ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'
            )}>
              {splitComplete ? (
                <div className="flex items-center justify-center gap-2 text-success">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Payment complete!</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Paid: KES {splitTotal.toLocaleString()} / KES {total.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Remaining: KES {splitRemaining.toLocaleString()}
                  </p>
                </>
              )}
            </div>

            {/* Add new payment */}
            {!splitComplete && (
              <div className="border rounded-lg p-3 space-y-3">
                <Label className="text-sm font-medium">Add Payment</Label>
                
                <div className="flex gap-2">
                  {(['cash', 'mpesa', 'card'] as const).map((method) => (
                    <Button
                      key={method}
                      variant={activeSplitMethod === method ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveSplitMethod(method)}
                      className="flex-1"
                    >
                      {getMethodIcon(method)}
                      <span className="ml-1 capitalize hidden sm:inline">{method}</span>
                    </Button>
                  ))}
                </div>

                <div>
                  <Label>Amount</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={splitAmount || ''}
                      onChange={(e) => setSplitAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Enter amount"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSplitAmount(splitRemaining)}
                    >
                      Remaining
                    </Button>
                  </div>
                </div>

                {activeSplitMethod === 'mpesa' && (
                  <>
                    <div>
                      <Label>M-Pesa Phone</Label>
                      <Input
                        type="tel"
                        placeholder="0712345678"
                        value={splitMpesaPhone}
                        onChange={(e) => setSplitMpesaPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>M-Pesa Reference (Optional)</Label>
                      <Input
                        placeholder="e.g. RKX7HG89TY"
                        value={splitMpesaRef}
                        onChange={(e) => setSplitMpesaRef(e.target.value.toUpperCase())}
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={addSplitPayment}
                  className="w-full"
                  disabled={splitAmount <= 0}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add {activeSplitMethod.charAt(0).toUpperCase() + activeSplitMethod.slice(1)} Payment
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            className="flex-[2]" 
            size="lg" 
            disabled={isProcessing || (paymentMethod === 'split' && !splitComplete)}
          >
            {isProcessing ? 'Processing...' : 'Complete Sale'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
