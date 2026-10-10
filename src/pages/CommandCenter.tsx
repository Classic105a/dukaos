import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, RefreshCw, Receipt, TrendingUp, Wallet, ShoppingCart } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { PageShell, StatCard, StatSkeleton, money, percentDelta } from '@/components/ds';
import { useSalesAggregates, useSalesWindow } from '@/hooks/useCommandCenter';
import {
  ActivityTimelineWidget,
  AttendanceWidget,
  BestSellersWidget,
  BranchComparisonWidget,
  CashFlowWidget,
  CriticalAlertsWidget,
  LowStockWidget,
  PendingApprovalsWidget,
  QuickActionsWidget,
  RevenueTrendWidget,
  SlowMovingWidget,
  StockTransfersWidget,
  SupplierDuesWidget,
  SystemHealthWidget,
} from '@/components/dashboard/widgets';

/**
 * Business Command Center — the decision surface for the business.
 * Alerts and pending work come first; KPIs are deliberately secondary.
 */
const CommandCenter = () => {
  const queryClient = useQueryClient();
  const { data: sales, isLoading } = useSalesWindow();
  const agg = useSalesAggregates(sales);

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['cc'] });

  return (
    <DashboardLayout>
      <PageShell
        title="Home"
        description="Today's sales, money received and what needs your attention"
        icon={<LayoutDashboard />}
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        }
      >
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Today
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard
                  label="Sold today"
                  value={money(agg.todayRevenue, { compact: true })}
                  icon={<Wallet />}
                  delta={percentDelta(agg.todayRevenue, agg.yesterdayRevenue)}
                  hint="vs yesterday"
                />
                <StatCard label="Profit" value={money(agg.todayProfit, { compact: true })} icon={<TrendingUp />} tone="success" />
                <StatCard label="Sales made" value={agg.todayCount} icon={<ShoppingCart />} />
                <StatCard label="Average sale" value={money(agg.averageBasket, { compact: true })} icon={<Receipt />} />
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <QuickActionsWidget />
          <CashFlowWidget saleIds={agg.todayIds} />
          <CriticalAlertsWidget />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LowStockWidget />
          <PendingApprovalsWidget />
        </div>

        <details className="group rounded-xl border border-border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground">
            More insights
            <span className="ml-2 text-xs font-normal text-muted-foreground">trends, best sellers, branches, activity</span>
          </summary>
          <div className="space-y-3 p-3 pt-0">
            <RevenueTrendWidget trend={agg.trend} loading={isLoading} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <BestSellersWidget />
              <SlowMovingWidget />
              <StockTransfersWidget />
              <SupplierDuesWidget />
              <BranchComparisonWidget byBranch={agg.byBranch} loading={isLoading} />
              <AttendanceWidget />
              <SystemHealthWidget />
            </div>
            <ActivityTimelineWidget />
          </div>
        </details>
      </PageShell>
    </DashboardLayout>
  );
};

export default CommandCenter;