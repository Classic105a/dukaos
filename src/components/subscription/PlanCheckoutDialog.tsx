import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { money, StatusBadge } from '@/components/ds';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import { usePriceQuote, BillingCycle } from '@/hooks/usePricing';
import { useBillingSettings } from '@/lib/billing-config';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: { id: string; name: string } | null;
  cycle: BillingCycle;
  coupon?: string;
}

const schema = z.object({
  reference: z.string().trim().min(6, 'Enter the confirmation code from your M-Pesa message').max(40),
  phone: z.string().trim().max(20).optional(),
});

/** Owner buys/renews a plan. The server prices it and records a pending invoice. */
export const PlanCheckoutDialog = ({ open, onOpenChange, plan, cycle, coupon }: Props) => {
  const { currentBusiness } = useBusiness();
  const qc = useQueryClient();
  const { data: quote, isLoading } = usePriceQuote(plan?.id, cycle, coupon);
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const amount = Number(quote?.final_amount ?? 0);
  const free = !isLoading && quote && amount === 0;
  const { data: billing } = useBillingSettings();
  const label = billing?.account_label?.trim() || 'Business name';
  const accountNo = /^business name$/i.test(label) ? (currentBusiness?.name?.slice(0, 20) ?? 'DUKAOS') : label;

  const submit = useMutation({
    mutationFn: async () => {
      if (!free) {
        const parsed = schema.safeParse({ reference, phone });
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      }
      const { data, error } = await (supabase as any).rpc('create_subscription_checkout', {
        p_business_id: currentBusiness!.id,
        p_plan_id: plan!.id,
        p_cycle: cycle,
        p_coupon: coupon || null,
        p_method: 'mpesa_paybill',
        p_reference: free ? null : reference.trim(),
        p_phone: phone.trim() || null,
      });
      if (error) throw error;
      return data as { status: string };
    },
    onSuccess: res => {
      ['business-subscription', 'subscription-invoices', 'plan-usage'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(res.status === 'paid' ? 'Plan activated' : 'Payment received — your plan activates once it is confirmed.');
      setReference('');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Could not submit payment'),
  });

  return (
    <Dialog open={open} onOpenChange={o => !submit.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan?.name} plan</DialogTitle>
          <DialogDescription>Billed {cycle}. Your current period is extended, nothing is lost.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Amount to pay</span>
          <span className="text-lg font-bold">
            {isLoading ? '…' : money(amount)}
            {quote && quote.total_discount > 0 && (
              <StatusBadge tone="success" className="ml-2">-{money(Number(quote.total_discount))}</StatusBadge>
            )}
          </span>
        </div>

        {!free && (
          <div className="space-y-3">
            {!billing?.paybill_number ? (
              <p className="text-sm rounded-lg bg-warning/10 text-warning p-3">
                Payment details are not set up yet. Please contact DukaOS support to pay.
              </p>
            ) : (
            <ol className="text-sm space-y-1 list-decimal pl-5 text-muted-foreground">
              <li>Open M-Pesa → Lipa na M-Pesa → Pay Bill</li>
              <li>Business no. <span className="font-semibold text-foreground">{billing.paybill_number}</span></li>
              <li>Account no. <span className="font-semibold text-foreground break-all">{accountNo}</span></li>
              <li>Amount <span className="font-semibold text-foreground">{money(amount)}</span>, then enter the code below</li>
            </ol>
            )}
            {billing?.instructions && (
              <p className="text-xs text-muted-foreground whitespace-pre-line">{billing.instructions}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ref">M-Pesa confirmation code</Label>
              <Input id="ref" value={reference} maxLength={40} placeholder="e.g. SJK7X2ABCD"
                onChange={e => setReference(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone that paid (optional)</Label>
              <Input id="phone" value={phone} maxLength={20} inputMode="tel" placeholder="07XX XXX XXX"
                onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || isLoading || !plan}>
            {submit.isPending ? 'Submitting…' : free ? 'Activate plan' : 'I have paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlanCheckoutDialog;
