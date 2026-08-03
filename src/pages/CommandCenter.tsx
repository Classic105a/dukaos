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
        title="Command Center"
        description="What requires your attention today"
        icon={<LayoutDashboard />}
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <CriticalAlertsWidget />
          <QuickActionsWidget />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <PendingApprovalsWidget />
          <StockTransfersWidget />
          <SupplierDuesWidget />
          <LowStockWidget />
          <SlowMovingWidget />
          <BestSellersWidget />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <RevenueTrendWidget trend={agg.trend} loading={isLoading} />
          <CashFlowWidget saleIds={agg.todayIds} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <BranchComparisonWidget byBranch={agg.byBranch} loading={isLoading} />
          <AttendanceWidget />
          <SystemHealthWidget />
        </div>
        <ActivityTimelineWidget />
        <section className="pt-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Today at a glance
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard
                  label="Revenue"
                  value={money(agg.todayRevenue, { compact: true })}
                  icon={<Wallet />}
                  delta={percentDelta(agg.todayRevenue, agg.yesterdayRevenue)}
                  hint="vs yesterday"
                />
                <StatCard
                  label="Profit"
                  value={money(agg.todayProfit, { compact: true })}
                  icon={<TrendingUp />}
                  tone="success"
                />
                <StatCard label="Transactions" value={agg.todayCount} icon={<ShoppingCart />} />
                <StatCard
                  label="Avg. basket"
                  value={money(agg.averageBasket, { compact: true })}
                  icon={<Receipt />}
                />
              </>
            )}
          </div>
        </section>
      </PageShell>
    </DashboardLayout>
  );
};

export default CommandCenter;