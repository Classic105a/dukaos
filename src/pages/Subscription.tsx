import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageShell, Surface, SurfaceHeader, StatusBadge, money, ListSkeleton } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Check, ShieldCheck, Gauge, TicketPercent } from 'lucide-react';
import {
  usePlans,
  useSubscription,
  useSubscriptionInvoices,
  useBusinessModules,
} from '@/hooks/useSubscription';
import { usePlanPrices, usePriceQuote, useBusinessPriceOverrides, BillingCycle } from '@/hooks/usePricing';
import { useUsage } from '@/hooks/useUsage';
import { MODULE_CATALOG, ModuleDefinition, ModuleKey, getIndustry } from '@/lib/industry-modules';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  trialing: { label: 'Free trial', tone: 'success' },
  active: { label: 'Active', tone: 'success' },
  grace: { label: 'Grace period', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const Subscription = () => {
  const { status, daysRemaining, plan, isLoading } = useSubscription();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const { data: invoices = [] } = useSubscriptionInvoices();
  const { industry, isModuleEnabled, setModule } = useBusinessModules();
  const { data: prices } = usePlanPrices();
  const { data: overrides = [] } = useBusinessPriceOverrides();
  const { rows: usageRows, isLoading: usageLoading } = useUsage();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const { data: quote } = usePriceQuote(plan?.id, cycle, coupon);

  const meta = STATUS_LABEL[status] ?? STATUS_LABEL.trialing;
  const industryDef = getIndustry(industry);

  /** Pricing always comes from the pricing engine — plans only define capabilities. */
  const priceFor = (planId: string, fallbackMonthly: number, fallbackYearly: number) => {
    const row = prices?.get(planId);
    return {
      monthly: Number(row?.price_monthly ?? fallbackMonthly),
      yearly: Number(row?.price_yearly_discounted ?? row?.price_yearly ?? fallbackYearly),
    };
  };

  const modules = useMemo(
    () => Object.values(MODULE_CATALOG) as ModuleDefinition[],
    []
  );

  const toggleModule = (key: ModuleKey, enabled: boolean) => {
    setModule.mutate(
      { key, enabled },
      {
        onSuccess: () => toast.success(`${MODULE_CATALOG[key].label} ${enabled ? 'enabled' : 'disabled'}`),
        onError: (e: any) => toast.error(e?.message ?? 'Could not update module'),
      }
    );
  };

  return (
    <DashboardLayout>
      <PageShell
        title="Subscription & Modules"
        description="Manage your DukaOS plan, billing history and the modules your business uses."
        icon={<CreditCard />}
      >
        {isLoading ? (
          <ListSkeleton />
        ) : (
          <Surface tone={status === 'expired' ? 'danger' : status === 'grace' ? 'warning' : 'primary'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold truncate">{plan?.name ?? 'Starter'}</h2>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 break-words">
                  {daysRemaining !== null && daysRemaining > 0
                    ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
                    : status === 'grace'
                      ? 'Your grace period is running — renew to avoid read-only mode.'
                      : status === 'expired'
                        ? 'Your subscription has expired. Renew to restore full access.'
                        : plan?.description}
                </p>
              </div>
              <div className="shrink-0 text-sm">
                {quote && quote.total_discount > 0 && (
                  <span className="text-muted-foreground line-through mr-1">{money(Number(quote.base_amount))}</span>
                )}
                <span className="font-semibold">
                  {money(Number(quote?.final_amount ?? priceFor(plan?.id ?? '', Number(plan?.price_monthly ?? 0), 0).monthly))}
                </span>
                <span className="text-muted-foreground"> / {cycle === 'monthly' ? 'month' : 'year'}</span>
                {overrides.length > 0 && (
                  <div className="mt-1"><StatusBadge tone="success">Custom pricing</StatusBadge></div>
                )}
              </div>
            </div>
          </Surface>
        )}

        <Surface padding="lg">
          <SurfaceHeader
            title="Usage this period"
            description="Live consumption against your plan allowances."
            icon={<Gauge />}
          />
          {usageLoading ? (
            <ListSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {usageRows.map(row => (
                <div key={row.key} className="rounded-lg border border-border p-3 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium truncate">{row.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {row.used} / {row.allowed ?? '∞'}
                    </span>
                  </div>
                  <Progress value={row.allowed === null ? 0 : row.percent} className="h-2" />
                  <p className="text-2xs text-muted-foreground mt-1.5">
                    {row.allowed === null
                      ? 'Unlimited on this plan'
                      : row.exceeded
                        ? 'Limit reached — upgrade to add more'
                        : `${row.remaining} remaining`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface padding="lg">
          <SurfaceHeader title="Plans" description="Upgrade or downgrade at any time." />
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(['monthly', 'yearly'] as BillingCycle[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
                    cycle === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Input
                value={couponInput}
                onChange={e => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                className="h-8 w-36 text-xs"
                maxLength={32}
              />
              <Button size="sm" variant="outline" className="h-8" onClick={() => setCoupon(couponInput.trim())}>
                <TicketPercent className="w-3.5 h-3.5 mr-1" /> Apply
              </Button>
            </div>
            {coupon && quote?.promo_status && (
              <StatusBadge tone={quote.promo_status === 'applied' ? 'success' : 'danger'}>
                {quote.promo_status.replace(/_/g, ' ')}
              </StatusBadge>
            )}
          </div>
          {plansLoading ? (
            <ListSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map(p => {
                const current = p.id === plan?.id;
                const pricing = priceFor(p.id, Number(p.price_monthly), Number(p.price_yearly));
                return (
                  <Surface
                    key={p.id}
                    tone={current ? 'primary' : 'default'}
                    elevation="flat"
                    className="flex flex-col gap-2 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">{p.name}</span>
                      {current && <StatusBadge tone="success">Current</StatusBadge>}
                    </div>
                    <div className="text-xl font-bold">
                      {money(cycle === 'monthly' ? pricing.monthly : pricing.yearly)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /{cycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground break-words">{p.description}</p>
                    <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.max_branches ?? 'Unlimited'} branches</li>
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.max_employees ?? 'Unlimited'} employees</li>
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.max_products ?? 'Unlimited'} products</li>
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.support_level} support</li>
                    </ul>
                    <div className="text-2xs text-muted-foreground mt-auto pt-2">
                      {cycle === 'monthly'
                        ? `${money(pricing.yearly)} billed yearly`
                        : `${money(pricing.monthly)} billed monthly`}
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </Surface>

        <Surface padding="lg">
          <SurfaceHeader
            title="Modules"
            description={`Defaults tuned for ${industryDef.label}. Turn on only what this business needs.`}
            icon={<ShieldCheck />}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {modules.map(m => (
              <div
                key={m.key}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.label}</p>
                  <p className="text-xs text-muted-foreground break-words">{m.description}</p>
                </div>
                <Switch
                  className="shrink-0"
                  checked={m.core ? true : isModuleEnabled(m.key)}
                  disabled={m.core || setModule.isPending}
                  onCheckedChange={value => toggleModule(m.key, value)}
                  aria-label={`Toggle ${m.label}`}
                />
              </div>
            ))}
          </div>
        </Surface>

        <Surface padding="lg">
          <SurfaceHeader title="Billing history" description="Invoices and payments for this business." />
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet — you're on a free trial.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString()} · {inv.billing_cycle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">{money(Number(inv.amount))}</span>
                    <StatusBadge tone={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'}>
                      {inv.status}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </PageShell>
    </DashboardLayout>
  );
};

export default Subscription;