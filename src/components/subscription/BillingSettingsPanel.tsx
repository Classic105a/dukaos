import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Surface, SurfaceHeader } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBillingSettings, useSaveBillingSettings } from '@/lib/billing-config';

/** Platform admin: the Pay Bill number and instructions shown to businesses at checkout. */
const BillingSettingsPanel = () => {
  const { data } = useBillingSettings();
  const save = useSaveBillingSettings();
  const [paybill, setPaybill] = useState('');
  const [label, setLabel] = useState('Business name');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (!data) return;
    setPaybill(data.paybill_number ?? '');
    setLabel(data.account_label ?? 'Business name');
    setInstructions(data.instructions ?? '');
  }, [data]);

  const submit = () => {
    if (paybill && !/^\d{5,10}$/.test(paybill.trim())) {
      toast.error('Pay Bill number should be 5–10 digits');
      return;
    }
    save.mutate(
      { paybill_number: paybill, account_label: label, instructions },
      { onSuccess: () => toast.success('Payment details saved'), onError: (e: any) => toast.error(e?.message ?? 'Could not save') },
    );
  };

  return (
    <Surface padding="lg">
      <SurfaceHeader title="Payment details" description="Shown to every business when they pay for a plan." />
      <div className="space-y-3 max-w-lg">
        <div className="space-y-1.5">
          <Label htmlFor="pb">M-Pesa Pay Bill number</Label>
          <Input id="pb" inputMode="numeric" value={paybill} maxLength={10} placeholder="e.g. 522522"
            onChange={e => setPaybill(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc">Account number to use</Label>
          <Input id="acc" value={label} maxLength={60} onChange={e => setLabel(e.target.value)} />
          <p className="text-xs text-muted-foreground">Write "Business name" to use each business's own name.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ins">Extra instructions (optional)</Label>
          <Textarea id="ins" rows={4} maxLength={600} value={instructions}
            placeholder="e.g. Payments are confirmed within 2 hours. Call 07XX for help."
            onChange={e => setInstructions(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={save.isPending} className="w-full sm:w-auto">
          {save.isPending ? 'Saving…' : 'Save payment details'}
        </Button>
      </div>
    </Surface>
  );
};

export default BillingSettingsPanel;
