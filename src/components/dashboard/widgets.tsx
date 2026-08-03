import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  FileWarning,
  Flame,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Truck,
  UserCheck,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Surface, StatusBadge, InlineEmpty, money, ChartSkeleton } from '@/components/ds';
import { Widget, WidgetRow } from './Widget';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  useActionQueue,
  useAttendance,
  useBestSellers,
  useCashFlow,
  useLowStock,
  useRecentActivity,
  useSlowMoving,
} from '@/hooks/useCommandCenter';

const timeAgo = (iso?: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

/* ─────────────────────────── Critical alerts ─────────────────────────── */

export const CriticalAlertsWidget = memo(() => {
  const navigate = useNavigate();
  const lowStock = useLowStock();
  const queue = useActionQueue();
  const { isOnline, pendingCount } = useOfflineSync();

  const alerts = useMemo(() => {
    const list: { id: string; label: string; detail: string; tone: 'danger' | 'warning'; to?: string }[] = [];
    const outOfStock = (lowStock.data || []).filter(p => p.quantity <= 0);
    if (outOfStock.length) {
      list.push({
        id: 'oos',
        label: `${outOfStock.length} product${outOfStock.length > 1 ? 's' : ''} out of stock`,
        detail: outOfStock.slice(0, 3).map(p => p.name).join(', '),
        tone: 'danger',
        to: '/inventory',
      });
    }
    const low = (lowStock.data || []).filter(p => p.quantity > 0);
    if (low.length) {
      list.push({
        id: 'low',
        label: `${low.length} product${low.length > 1 ? 's' : ''} below reorder level`,
        detail: low.slice(0, 3).map(p => `${p.name} (${p.quantity})`).join(', '),
        tone: 'warning',
        to: '/inventory',
      });
    }
    const approvals = queue.data?.approvals?.length ?? 0;
    if (approvals) {
      list.push({
        id: 'approvals',
        label: `${approvals} approval${approvals > 1 ? 's' : ''} waiting`,
        detail: 'Manager action required',
        tone: 'warning',
        to: '/audit-log',
      });
    }
    if (!isOnline || pendingCount > 0) {
      list.push({
        id: 'sync',
        label: !isOnline ? 'Working offline' : `${pendingCount} sale(s) pending sync`,
        detail: 'Sales are stored locally and will sync automatically',
        tone: !isOnline ? 'warning' : 'danger',
      });
    }
    return list;
  }, [lowStock.data, queue.data, isOnline, pendingCount]);

  return (
    <Widget
      title="What needs your attention"
      description="Critical alerts across this business"
      icon={<AlertTriangle />}
      tone={alerts.length ? 'danger' : 'success'}
      loading={lowStock.isLoading || queue.isLoading}
      error={lowStock.error || queue.error}
      onRetry={() => {
        lowStock.refetch();
        queue.refetch();
      }}
      className="lg:col-span-2"
    >
      {alerts.length === 0 ? (
        <InlineEmpty message="No critical issues. Everything is running normally." />
      ) : (
        <div className="space-y-1">
          {alerts.map(a => (
            <WidgetRow
              key={a.id}
              onClick={a.to ? () => navigate(a.to!) : undefined}
              leading={
                <span
                  className={
                    a.tone === 'danger'
                      ? 'w-2 h-2 rounded-full bg-destructive block'
                      : 'w-2 h-2 rounded-full bg-warning block'
                  }
                />
              }
              title={a.label}
              subtitle={a.detail}
              trailing={<StatusBadge tone={a.tone} size="sm">{a.tone === 'danger' ? 'Critical' : 'Review'}</StatusBadge>}
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
CriticalAlertsWidget.displayName = 'CriticalAlertsWidget';

/* ─────────────────────────── Quick actions ─────────────────────────── */

export const QuickActionsWidget = memo(() => {
  const navigate = useNavigate();
  const actions = [
    { label: 'New Sale', icon: ShoppingCart, to: '/dashboard' },
    { label: 'Add Stock', icon: Boxes, to: '/inventory' },
    { label: 'Receive Goods', icon: Truck, to: '/warehouse' },
    { label: 'Sales History', icon: Activity, to: '/reports' },
  ];
  return (
    <Widget title="Quick actions" icon={<Zap />} tone="primary">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => (
          <Button
            key={a.label}
            variant="outline"
            className="h-16 flex-col gap-1.5 text-xs font-medium"
            onClick={() => navigate(a.to)}
          >
            <a.icon className="w-4 h-4" />
            {a.label}
          </Button>
        ))}
      </div>
    </Widget>
  );
});
QuickActionsWidget.displayName = 'QuickActionsWidget';

/* ─────────────────────────── Revenue trend ─────────────────────────── */

export const RevenueTrendWidget = memo(
  ({ trend, loading }: { trend: { date: string; revenue: number }[]; loading?: boolean }) => (
    <Widget
      title="Revenue trend"
      description="Last 14 days"
      icon={<Activity />}
      href="/analytics"
      hrefLabel="Analytics"
      className="lg:col-span-2"
    >
      {loading ? (
        <ChartSkeleton height={160} />
      ) : (
        <div className="h-[160px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="ccRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: any) => money(Number(v))}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#ccRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Widget>
  )
);
RevenueTrendWidget.displayName = 'RevenueTrendWidget';

/* ─────────────────────────── Cash flow ─────────────────────────── */

export const CashFlowWidget = memo(({ saleIds }: { saleIds: string[] }) => {
  const { data, isLoading, error, refetch } = useCashFlow(saleIds);
  const total = (data || []).reduce((s, r) => s + r.amount, 0);
  return (
    <Widget
      title="Cash flow today"
      description="Collected by payment method"
      icon={<Banknote />}
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data || data.length === 0 ? (
        <InlineEmpty icon={Banknote} message="No payments collected yet today." />
      ) : (
        <div className="space-y-2">
          {data.map(row => (
            <div key={row.method} className="min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="capitalize truncate">{row.method.replace(/_/g, ' ')}</span>
                <span className="font-semibold tabular-nums shrink-0">{money(row.amount)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total ? (row.amount / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
});
CashFlowWidget.displayName = 'CashFlowWidget';

/* ─────────────────────────── Low stock ─────────────────────────── */

export const LowStockWidget = memo(() => {
  const { data, isLoading, error, refetch } = useLowStock();
  return (
    <Widget
      title="Low stock"
      description="At or below reorder level"
      icon={<Boxes />}
      href="/inventory"
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data || data.length === 0 ? (
        <InlineEmpty message="Stock levels are healthy." />
      ) : (
        <div>
          {data.slice(0, 5).map(p => (
            <WidgetRow
              key={p.productId}
              title={p.name}
              subtitle={`Reorder at ${p.threshold}`}
              trailing={
                <StatusBadge tone={p.quantity <= 0 ? 'danger' : 'warning'} size="sm">
                  {p.quantity} left
                </StatusBadge>
              }
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
LowStockWidget.displayName = 'LowStockWidget';

/* ─────────────────────────── Approvals / transfers / payables ─────────────────────────── */

export const PendingApprovalsWidget = memo(() => {
  const { data, isLoading, error, refetch } = useActionQueue();
  return (
    <Widget
      title="Pending approvals"
      icon={<ShieldCheck />}
      href="/audit-log"
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data?.approvals?.length ? (
        <InlineEmpty message="Nothing waiting for approval." />
      ) : (
        <div>
          {data.approvals.slice(0, 5).map((a: any) => (
            <WidgetRow
              key={a.id}
              title={String(a.request_type || 'Request').replace(/_/g, ' ')}
              subtitle={a.reason || timeAgo(a.created_at)}
              trailing={<StatusBadge tone="warning" size="sm">Pending</StatusBadge>}
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
PendingApprovalsWidget.displayName = 'PendingApprovalsWidget';

export const StockTransfersWidget = memo(() => {
  const { data, isLoading, error, refetch } = useActionQueue();
  const { branches } = useBranch();
  const nameOf = (id: string) => branches.find(b => b.id === id)?.name || 'Branch';
  return (
    <Widget
      title="Stock transfers"
      description="Pending / in transit"
      icon={<ArrowLeftRight />}
      href="/inventory"
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data?.transfers?.length ? (
        <InlineEmpty message="No transfers in flight." />
      ) : (
        <div>
          {data.transfers.slice(0, 5).map((t: any) => (
            <WidgetRow
              key={t.id}
              title={`${nameOf(t.from_branch_id)} → ${nameOf(t.to_branch_id)}`}
              subtitle={timeAgo(t.created_at)}
              trailing={
                <StatusBadge tone={t.status === 'in_transit' ? 'info' : 'warning'} size="sm">
                  {t.quantity} units
                </StatusBadge>
              }
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
StockTransfersWidget.displayName = 'StockTransfersWidget';

export const SupplierDuesWidget = memo(() => {
  const { data, isLoading, error, refetch } = useActionQueue();
  return (
    <Widget
      title="Supplier invoices due"
      icon={<FileWarning />}
      href="/parties"
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data?.payables?.length ? (
        <InlineEmpty message="No outstanding supplier balances." />
      ) : (
        <div>
          {data.payables.map(p => (
            <WidgetRow key={p.id} title={p.name} subtitle="Outstanding balance" trailing={money(p.balance)} />
          ))}
        </div>
      )}
    </Widget>
  );
});
SupplierDuesWidget.displayName = 'SupplierDuesWidget';

/* ─────────────────────────── Branch comparison ─────────────────────────── */

export const BranchComparisonWidget = memo(
  ({ byBranch, loading }: { byBranch: Map<string, { revenue: number; count: number }>; loading?: boolean }) => {
    const { branches, currentBranch } = useBranch();
    const rows = useMemo(() => {
      const list = branches.map(b => ({
        id: b.id,
        name: b.name,
        revenue: byBranch.get(b.id)?.revenue ?? 0,
        count: byBranch.get(b.id)?.count ?? 0,
      }));
      return list.sort((a, b) => b.revenue - a.revenue);
    }, [branches, byBranch]);
    const max = rows[0]?.revenue || 0;

    return (
      <Widget title="Branch performance" description="Revenue today" icon={<Building2 />} href="/branches" loading={loading}>
        {rows.length === 0 ? (
          <InlineEmpty icon={Building2} message="No branches configured." />
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 6).map(r => (
              <div key={r.id} className="min-w-0">
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <span className="truncate">
                    {r.name}
                    {r.id === currentBranch?.id && (
                      <StatusBadge tone="primary" size="sm" className="ml-1.5">You</StatusBadge>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">{money(r.revenue, { compact: true })}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${max ? (r.revenue / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Widget>
    );
  }
);
BranchComparisonWidget.displayName = 'BranchComparisonWidget';

/* ─────────────────────────── Products ─────────────────────────── */

export const BestSellersWidget = memo(() => {
  const { data, isLoading, error, refetch } = useBestSellers();
  return (
    <Widget
      title="Best sellers"
      description="Last 7 days"
      icon={<Flame />}
      href="/analytics"
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data?.length ? (
        <InlineEmpty icon={Flame} message="No sales recorded in the last 7 days." />
      ) : (
        <div>
          {data.slice(0, 5).map((p, i) => (
            <WidgetRow
              key={p.name}
              leading={
                <span className="w-6 h-6 rounded-md bg-muted text-2xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              }
              title={p.name}
              subtitle={`${p.units} units`}
              trailing={money(p.revenue, { compact: true })}
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
BestSellersWidget.displayName = 'BestSellersWidget';

export const SlowMovingWidget = memo(() => {
  const { data, isLoading, error, refetch } = useSlowMoving();
  return (
    <Widget
      title="Slow-moving stock"
      description="No movement in 30+ days"
      icon={<Snowflake />}
      href="/smart-inventory"
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data?.length ? (
        <InlineEmpty message="No dead stock detected." />
      ) : (
        <div>
          {data.slice(0, 5).map(p => (
            <WidgetRow
              key={p.productId}
              title={p.name}
              subtitle={`${p.quantity} on hand · last moved ${timeAgo(p.lastMovement)}`}
              trailing={money(p.value, { compact: true })}
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
SlowMovingWidget.displayName = 'SlowMovingWidget';

/* ─────────────────────────── People & activity ─────────────────────────── */

export const AttendanceWidget = memo(() => {
  const { data, isLoading, error, refetch } = useAttendance();
  const open = (data || []).filter(s => s.status === 'open').length;
  return (
    <Widget
      title="Staff on shift"
      description={`${open} open · ${(data?.length ?? 0) - open} closed today`}
      icon={<UserCheck />}
      loading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {!data?.length ? (
        <InlineEmpty icon={UserCheck} message="No shifts opened today." />
      ) : (
        <div>
          {data.slice(0, 5).map(s => (
            <WidgetRow
              key={s.id}
              leading={
                <span className="w-7 h-7 rounded-lg bg-gradient-hero text-primary-foreground text-2xs font-bold flex items-center justify-center">
                  {s.name.charAt(0).toUpperCase()}
                </span>
              }
              title={s.name}
              subtitle={`Since ${new Date(s.openedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`}
              trailing={
                <StatusBadge tone={s.status === 'open' ? 'success' : 'neutral'} size="sm">
                  {s.status === 'open' ? 'On shift' : 'Closed'}
                </StatusBadge>
              }
            />
          ))}
        </div>
      )}
    </Widget>
  );
});
AttendanceWidget.displayName = 'AttendanceWidget';

export const ActivityTimelineWidget = memo(() => {
  const { data, isLoading, error, refetch } = useRecentActivity();
  return (
    <Widget
      title="Recent activity"
      icon={<Clock />}
      href="/audit-log"
      loading={isLoading}
      error={error}
      onRetry={refetch}
      className="lg:col-span-2"
    >
      {!data?.length ? (
        <InlineEmpty icon={Clock} message="No recorded activity yet." />
      ) : (
        <ol className="relative pl-4 border-l border-border space-y-3">
          {data.slice(0, 8).map((a: any) => (
            <li key={a.id} className="min-w-0">
              <span className="absolute -left-[5px] w-2 h-2 rounded-full bg-primary" />
              <p className="text-xs font-medium truncate">
                {String(a.action || '').replace(/_/g, ' ')}
                <span className="text-muted-foreground font-normal"> · {a.entity_type}</span>
              </p>
              <p className="text-2xs text-muted-foreground">{timeAgo(a.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  );
});
ActivityTimelineWidget.displayName = 'ActivityTimelineWidget';

export const SystemHealthWidget = memo(() => {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const items = [
    {
      label: 'Connectivity',
      value: isOnline ? 'Online' : 'Offline',
      tone: isOnline ? ('success' as const) : ('warning' as const),
      icon: isOnline ? Wifi : WifiOff,
    },
    {
      label: 'Offline queue',
      value: pendingCount === 0 ? 'Empty' : `${pendingCount} pending`,
      tone: pendingCount === 0 ? ('success' as const) : ('warning' as const),
      icon: Boxes,
    },
    {
      label: 'Sync engine',
      value: isSyncing ? 'Syncing…' : 'Idle',
      tone: 'info' as const,
      icon: Activity,
    },
  ];
  return (
    <Widget title="System health" icon={<CheckCircle2 />} href="/observability" hrefLabel="Diagnostics">
      <div className="space-y-1">
        {items.map(i => (
          <WidgetRow
            key={i.label}
            leading={<i.icon className="w-4 h-4 text-muted-foreground" />}
            title={i.label}
            trailing={<StatusBadge tone={i.tone} size="sm">{i.value}</StatusBadge>}
          />
        ))}
      </div>
    </Widget>
  );
});
SystemHealthWidget.displayName = 'SystemHealthWidget';

export { Surface };