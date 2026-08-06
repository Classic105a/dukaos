import { useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageShell, Surface, SurfaceHeader, StatusBadge, money, ListSkeleton } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CreditCard, Check, ShieldCheck } from 'lucide-react';
import {
  usePlans,
  useSubscription,
  useSubscriptionInvoices,
  useBusinessModules,
} from '@/hooks/useSubscription';
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

  const meta = STATUS_LABEL[status] ?? STATUS_LABEL.trialing;
  const industryDef = getIndustry(industry);

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
                <span className="font-semibold">{money(Number(plan?.price_monthly ?? 0))}</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
            </div>
          </Surface>
        )}

        <Surface padding="lg">
          <SurfaceHeader title="Plans" description="Upgrade or downgrade at any time." />
          {plansLoading ? (
            <ListSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map(p => {
                const current = p.id === plan?.id;
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
                    <div className="text-xl font-bold">{money(Number(p.price_monthly))}</div>
                    <p className="text-xs text-muted-foreground break-words">{p.description}</p>
                    <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.max_branches ?? 'Unlimited'} branches</li>
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.max_employees ?? 'Unlimited'} employees</li>
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.max_products ?? 'Unlimited'} products</li>
                      <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.support_level} support</li>
                    </ul>
                    <div className="text-2xs text-muted-foreground mt-auto pt-2">
                      {money(Number(p.price_yearly))} billed yearly
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