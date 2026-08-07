import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageShell, Surface, SurfaceHeader, StatusBadge, money, ListSkeleton, InlineEmpty } from '@/components/ds';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, Banknote, TicketPercent, Building2, ScrollText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { usePlans } from '@/hooks/useSubscription';
import { useIsPlatformAdmin } from '@/hooks/usePricing';
import {
  useAdminBusinesses, useAdminOverrides, useAdminPlanPrices, useAdminPromotions,
  useBillingAuditLog, useBillingMutations,
} from '@/hooks/useBillingAdmin';

const OVERRIDE_TYPES = [
  { value: 'custom_price', label: 'Custom negotiated price' },
  { value: 'percent_discount', label: 'Permanent % discount' },
  { value: 'temporary_discount', label: 'Temporary % discount' },
  { value: 'fixed_discount', label: 'Fixed amount off' },
  { value: 'waiver', label: '100% waiver' },
  { value: 'lifetime_free', label: 'Lifetime free' },
];

const BillingAdmin = () => {
  const { data: isAdmin, isLoading: adminLoading } = useIsPlatformAdmin();
  const enabled = !!isAdmin;
  const { data: plans = [] } = usePlans();
  const { data: subs = [], isLoading: subsLoading } = useAdminBusinesses(enabled);
  const { data: prices = [], isLoading: pricesLoading } = useAdminPlanPrices(enabled);
  const { data: overrides = [] } = useAdminOverrides(enabled);
  const { data: promos = [] } = useAdminPromotions(enabled);
  const { data: auditRows = [] } = useBillingAuditLog();
  const { savePrice, saveOverride, savePromotion, subscriptionAction } = useBillingMutations();

  const [priceForm, setPriceForm] = useState<any | null>(null);
  const [overrideForm, setOverrideForm] = useState<any | null>(null);
  const [promoForm, setPromoForm] = useState<any | null>(null);

  const run = (p: Promise<unknown>, ok: string) =>
    p.then(() => toast.success(ok)).catch((e: any) => toast.error(e?.message ?? 'Action failed'));

  if (adminLoading) {
    return <DashboardLayout><PageShell title="Billing & Pricing"><ListSkeleton /></PageShell></DashboardLayout>;
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <PageShell title="Billing & Pricing" icon={<ShieldAlert />}>
          <Surface tone="danger">
            <p className="text-sm">This area is restricted to DukaOS platform administrators.</p>
          </Surface>
        </PageShell>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageShell
        title="Billing & Pricing"
        description="Plans define capabilities. Pricing, discounts and waivers are configured here — never in code."
        icon={<Banknote />}
      >
        <Tabs defaultValue="businesses">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="businesses"><Building2 className="w-3.5 h-3.5 mr-1" />Businesses</TabsTrigger>
            <TabsTrigger value="pricing"><Banknote className="w-3.5 h-3.5 mr-1" />Pricing</TabsTrigger>
            <TabsTrigger value="overrides">Overrides</TabsTrigger>
            <TabsTrigger value="promotions"><TicketPercent className="w-3.5 h-3.5 mr-1" />Promotions</TabsTrigger>
            <TabsTrigger value="audit"><ScrollText className="w-3.5 h-3.5 mr-1" />Audit</TabsTrigger>
          </TabsList>

          {/* ── Businesses & lifecycle ── */}
          <TabsContent value="businesses" className="mt-3">
            <Surface padding="lg">
              <SurfaceHeader title="Subscriptions" description="Extend trials, grant free months, pause, resume or move plans." />
              {subsLoading ? <ListSkeleton /> : subs.length === 0 ? <InlineEmpty message="No subscriptions yet" /> : (
                <div className="space-y-2">
                  {subs.map((s: any) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.business?.name ?? 'Unknown business'}</p>
                          <p className="text-xs text-muted-foreground">{s.plan?.name ?? 'No plan'} · {s.billing_cycle}</p>
                        </div>
                        <StatusBadge tone={s.status === 'active' ? 'success' : s.status === 'trialing' ? 'success' : s.status === 'paused' ? 'warning' : 'danger'}>
                          {s.status}
                        </StatusBadge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => run(subscriptionAction.mutateAsync({ businessId: s.business_id, action: 'extend_trial', days: 30, reason: 'Admin trial extension' }), 'Trial extended 30 days')}>
                          +30d trial
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => run(subscriptionAction.mutateAsync({ businessId: s.business_id, action: 'free_months', days: 1, reason: 'Complimentary month' }), 'Free month granted')}>
                          +1 free month
                        </Button>
                        {s.status === 'paused' ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => run(subscriptionAction.mutateAsync({ businessId: s.business_id, action: 'resume' }), 'Resumed')}>Resume</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => run(subscriptionAction.mutateAsync({ businessId: s.business_id, action: 'pause' }), 'Paused')}>Pause</Button>
                        )}
                        <Select onValueChange={v => run(subscriptionAction.mutateAsync({ businessId: s.business_id, action: 'change_plan', planId: v, reason: 'Admin plan change' }), 'Plan changed')}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Move plan" /></SelectTrigger>
                          <SelectContent>
                            {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setOverrideForm({ business_id: s.business_id, plan_id: s.plan_id, override_type: 'custom_price', currency: 'KES', reason: '' })}>
                          Custom price
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </TabsContent>

          {/* ── Plan pricing ── */}
          <TabsContent value="pricing" className="mt-3">
            <Surface padding="lg">
              <SurfaceHeader
                title="Plan pricing"
                description="Schedule future prices with effective dates. Existing customers keep their price unless grandfathering is removed."
                action={
                  <Button size="sm" onClick={() => setPriceForm({ plan_id: plans[0]?.id, currency: 'KES', price_monthly: 0, price_yearly: 0, status: 'active', effective_from: new Date().toISOString().slice(0, 10) })}>
                    <Plus className="w-4 h-4 mr-1" />New price
                  </Button>
                }
              />
              {pricesLoading ? <ListSkeleton /> : (
                <div className="space-y-2">
                  {prices.map((p: any) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.plan?.name ?? 'Plan'}</p>
                        <p className="text-xs text-muted-foreground">
                          From {new Date(p.effective_from).toLocaleDateString()}
                          {p.effective_to ? ` to ${new Date(p.effective_to).toLocaleDateString()}` : ''}
                          {new Date(p.effective_from) > new Date() ? ' · scheduled' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">{money(Number(p.price_monthly))}/mo</span>
                        <span className="text-xs text-muted-foreground">{money(Number(p.price_yearly_discounted ?? p.price_yearly))}/yr</span>
                        <StatusBadge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</StatusBadge>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPriceForm({ ...p, plan: undefined, effective_from: p.effective_from.slice(0, 10) })}>Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </TabsContent>

          {/* ── Overrides ── */}
          <TabsContent value="overrides" className="mt-3">
            <Surface padding="lg">
              <SurfaceHeader title="Customer pricing overrides" description="Negotiated prices, discounts, waivers and lifetime-free deals." />
              {overrides.length === 0 ? <InlineEmpty message="No overrides configured" /> : (
                <div className="space-y-2">
                  {overrides.map((o: any) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{o.business?.name}</p>
                        <p className="text-xs text-muted-foreground break-words">
                          {OVERRIDE_TYPES.find(t => t.value === o.override_type)?.label ?? o.override_type} · {o.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {o.is_grandfathered && <StatusBadge tone="neutral">Grandfathered</StatusBadge>}
                        <StatusBadge tone={o.status === 'active' ? 'success' : 'neutral'}>{o.status}</StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </TabsContent>

          {/* ── Promotions ── */}
          <TabsContent value="promotions" className="mt-3">
            <Surface padding="lg">
              <SurfaceHeader
                title="Promotional campaigns"
                description="Coupon codes validated server-side at invoice time."
                action={
                  <Button size="sm" onClick={() => setPromoForm({ code: '', name: '', discount_type: 'percentage', discount_value: 10, is_active: true, max_per_business: 1 })}>
                    <Plus className="w-4 h-4 mr-1" />New campaign
                  </Button>
                }
              />
              {promos.length === 0 ? <InlineEmpty message="No campaigns yet" /> : (
                <div className="space-y-2">
                  {promos.map((p: any) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.code} — {p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `${money(Number(p.discount_value))} off`}
                          {p.ends_at ? ` · ends ${new Date(p.ends_at).toLocaleDateString()}` : ''}
                          {p.max_redemptions ? ` · ${p.current_redemptions}/${p.max_redemptions} used` : ''}
                        </p>
                      </div>
                      <StatusBadge tone={p.is_active ? 'success' : 'neutral'}>{p.is_active ? 'Active' : 'Disabled'}</StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </TabsContent>

          {/* ── Audit ── */}
          <TabsContent value="audit" className="mt-3">
            <Surface padding="lg">
              <SurfaceHeader title="Billing audit trail" description="Every pricing change, discount, waiver and lifecycle action." />
              {auditRows.length === 0 ? <InlineEmpty message="No billing activity yet" /> : (
                <div className="space-y-2">
                  {auditRows.map((a: any) => (
                    <div key={a.id} className="rounded-lg border border-border p-3 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{a.action}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground break-words">{a.entity_type}{a.reason ? ` · ${a.reason}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </TabsContent>
        </Tabs>

        {/* ── Price editor ── */}
        <Dialog open={!!priceForm} onOpenChange={o => !o && setPriceForm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{priceForm?.id ? 'Edit price' : 'New price'}</DialogTitle>
              <DialogDescription>Set an effective date in the future to schedule a price change.</DialogDescription>
            </DialogHeader>
            {priceForm && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Plan</Label>
                  <Select value={priceForm.plan_id} onValueChange={v => setPriceForm({ ...priceForm, plan_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Monthly</Label>
                    <Input type="number" value={priceForm.price_monthly} onChange={e => setPriceForm({ ...priceForm, price_monthly: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Yearly</Label>
                    <Input type="number" value={priceForm.price_yearly} onChange={e => setPriceForm({ ...priceForm, price_yearly: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Discounted yearly</Label>
                    <Input type="number" value={priceForm.price_yearly_discounted ?? ''} onChange={e => setPriceForm({ ...priceForm, price_yearly_discounted: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Effective from</Label>
                    <Input type="date" value={priceForm.effective_from} onChange={e => setPriceForm({ ...priceForm, effective_from: e.target.value })} /></div>
                </div>
                <div><Label className="text-xs">Notes</Label>
                  <Textarea rows={2} value={priceForm.notes ?? ''} onChange={e => setPriceForm({ ...priceForm, notes: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPriceForm(null)}>Cancel</Button>
              <Button
                disabled={savePrice.isPending}
                onClick={() => run(
                  savePrice.mutateAsync({ ...priceForm, effective_from: new Date(priceForm.effective_from).toISOString() })
                    .then(() => setPriceForm(null)),
                  'Price saved')}
              >Save price</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Override editor ── */}
        <Dialog open={!!overrideForm} onOpenChange={o => !o && setOverrideForm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customer pricing override</DialogTitle>
              <DialogDescription>Applied automatically before any invoice is generated.</DialogDescription>
            </DialogHeader>
            {overrideForm && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={overrideForm.override_type} onValueChange={v => setOverrideForm({ ...overrideForm, override_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OVERRIDE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {overrideForm.override_type === 'custom_price' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Custom monthly</Label>
                      <Input type="number" value={overrideForm.custom_monthly ?? ''} onChange={e => setOverrideForm({ ...overrideForm, custom_monthly: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Custom yearly</Label>
                      <Input type="number" value={overrideForm.custom_yearly ?? ''} onChange={e => setOverrideForm({ ...overrideForm, custom_yearly: Number(e.target.value) })} /></div>
                  </div>
                )}
                {['percent_discount', 'temporary_discount'].includes(overrideForm.override_type) && (
                  <div><Label className="text-xs">Discount %</Label>
                    <Input type="number" value={overrideForm.discount_percent ?? ''} onChange={e => setOverrideForm({ ...overrideForm, discount_percent: Number(e.target.value) })} /></div>
                )}
                {overrideForm.override_type === 'fixed_discount' && (
                  <div><Label className="text-xs">Amount off</Label>
                    <Input type="number" value={overrideForm.discount_amount ?? ''} onChange={e => setOverrideForm({ ...overrideForm, discount_amount: Number(e.target.value) })} /></div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Start</Label>
                    <Input type="date" value={(overrideForm.start_date ?? new Date().toISOString()).slice(0, 10)} onChange={e => setOverrideForm({ ...overrideForm, start_date: new Date(e.target.value).toISOString() })} /></div>
                  <div><Label className="text-xs">End (optional)</Label>
                    <Input type="date" value={overrideForm.end_date ? overrideForm.end_date.slice(0, 10) : ''} onChange={e => setOverrideForm({ ...overrideForm, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                </div>
                <div><Label className="text-xs">Reason (audited)</Label>
                  <Textarea rows={2} value={overrideForm.reason} onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOverrideForm(null)}>Cancel</Button>
              <Button
                disabled={saveOverride.isPending || !overrideForm?.reason}
                onClick={() => run(saveOverride.mutateAsync(overrideForm).then(() => setOverrideForm(null)), 'Override saved')}
              >Save override</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Promotion editor ── */}
        <Dialog open={!!promoForm} onOpenChange={o => !o && setPromoForm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promotional campaign</DialogTitle>
              <DialogDescription>Coupon codes are validated server-side before billing.</DialogDescription>
            </DialogHeader>
            {promoForm && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Code</Label>
                    <Input value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} maxLength={32} /></div>
                  <div><Label className="text-xs">Name</Label>
                    <Input value={promoForm.name} onChange={e => setPromoForm({ ...promoForm, name: e.target.value })} maxLength={80} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Discount type</Label>
                    <Select value={promoForm.discount_type} onValueChange={v => setPromoForm({ ...promoForm, discount_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Value</Label>
                    <Input type="number" value={promoForm.discount_value} onChange={e => setPromoForm({ ...promoForm, discount_value: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Max redemptions</Label>
                    <Input type="number" value={promoForm.max_redemptions ?? ''} onChange={e => setPromoForm({ ...promoForm, max_redemptions: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Ends</Label>
                    <Input type="date" value={promoForm.ends_at ? promoForm.ends_at.slice(0, 10) : ''} onChange={e => setPromoForm({ ...promoForm, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPromoForm(null)}>Cancel</Button>
              <Button
                disabled={savePromotion.isPending || !promoForm?.code || !promoForm?.name}
                onClick={() => run(savePromotion.mutateAsync(promoForm).then(() => setPromoForm(null)), 'Campaign saved')}
              >Save campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </DashboardLayout>
  );
};

export default BillingAdmin;
