import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';

/**
 * Business Command Center data layer.
 *
 * READ-ONLY. Every query is scoped by business_id (tenant) and cached by
 * react-query so widgets never trigger duplicate network round-trips.
 * Independent queries run in parallel; nothing blocks first paint.
 */

const DAY = 86_400_000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export interface SaleRow {
  id: string;
  created_at: string;
  total_amount: number;
  profit_total: number | null;
  branch_id: string;
  payment_status: string | null;
}

const common = (businessId?: string) => ({
  enabled: !!businessId,
  staleTime: 60_000,
  gcTime: 5 * 60_000,
});

/** 14-day sales window — powers revenue trend, today's profit, branch comparison. */
export const useSalesWindow = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;
  const since = useMemo(() => new Date(Date.now() - 14 * DAY).toISOString(), []);

  return useQuery({
    queryKey: ['cc', 'sales-window', businessId],
    ...common(businessId),
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, created_at, total_amount, profit_total, branch_id, payment_status')
        .eq('business_id', businessId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as SaleRow[];
    },
  });
};

/** Low stock across the current branch. */
export const useLowStock = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;

  return useQuery({
    queryKey: ['cc', 'low-stock', businessId, currentBranch?.id],
    ...common(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock')
        .select('product_id, quantity, products!inner(name, low_stock_threshold, is_active)')
        .eq('business_id', businessId!)
        .eq('branch_id', currentBranch!.id)
        .limit(1000);
      if (error) throw error;
      return (data || [])
        .map((row: any) => ({
          productId: row.product_id as string,
          name: row.products?.name as string,
          quantity: Number(row.quantity ?? 0),
          threshold: Number(row.products?.low_stock_threshold ?? 0),
          active: row.products?.is_active !== false,
        }))
        .filter(r => r.active && r.threshold > 0 && r.quantity <= r.threshold)
        .sort((a, b) => a.quantity - b.quantity);
    },
  });
};

/** Slow-moving stock: on hand but untouched for 30+ days. */
export const useSlowMoving = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;
  const cutoff = useMemo(() => new Date(Date.now() - 30 * DAY).toISOString(), []);

  return useQuery({
    queryKey: ['cc', 'slow-moving', businessId, currentBranch?.id],
    ...common(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock')
        .select('product_id, quantity, last_movement_at, products!inner(name, unit_price)')
        .eq('business_id', businessId!)
        .eq('branch_id', currentBranch!.id)
        .gt('quantity', 0)
        .lt('last_movement_at', cutoff)
        .order('last_movement_at', { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        productId: row.product_id as string,
        name: row.products?.name as string,
        quantity: Number(row.quantity ?? 0),
        value: Number(row.quantity ?? 0) * Number(row.products?.unit_price ?? 0),
        lastMovement: row.last_movement_at as string | null,
      }));
    },
  });
};

/** Best sellers over the last 7 days. */
export const useBestSellers = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;
  const since = useMemo(() => new Date(Date.now() - 7 * DAY).toISOString(), []);

  return useQuery({
    queryKey: ['cc', 'best-sellers', businessId],
    ...common(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select('product_name, quantity, total_amount, sales!inner(business_id, created_at)')
        .eq('sales.business_id', businessId!)
        .gte('sales.created_at', since)
        .limit(3000);
      if (error) throw error;
      const map = new Map<string, { name: string; units: number; revenue: number }>();
      for (const row of (data || []) as any[]) {
        const name = row.product_name || 'Unknown';
        const entry = map.get(name) || { name, units: 0, revenue: 0 };
        entry.units += Number(row.quantity ?? 0);
        entry.revenue += Number(row.total_amount ?? 0);
        map.set(name, entry);
      }
      return Array.from(map.values()).sort((a, b) => b.units - a.units).slice(0, 6);
    },
  });
};

/** Pending approvals + pending stock transfers + supplier payables. */
export const useActionQueue = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;

  return useQuery({
    queryKey: ['cc', 'action-queue', businessId, currentBranch?.id],
    ...common(businessId),
    queryFn: async () => {
      const [approvals, transfers, payables, purchaseOrders] = await Promise.all([
        supabase
          .from('approval_requests')
          .select('id, request_type, reason, created_at, status')
          .eq('status', 'pending')
          .eq('branch_id', currentBranch!.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('stock_transfers')
          .select('id, quantity, status, created_at, from_branch_id, to_branch_id')
          .eq('business_id', businessId!)
          .in('status', ['pending', 'in_transit'])
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('parties')
          .select('id, name, current_balance')
          .eq('business_id', businessId!)
          .eq('party_type', 'supplier')
          .gt('current_balance', 0)
          .order('current_balance', { ascending: false })
          .limit(6),
        supabase
          .from('purchase_orders')
          .select('id, order_number, total_amount, status, expected_delivery_date')
          .eq('business_id', businessId!)
          .in('status', ['pending', 'approved', 'draft'])
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      return {
        approvals: approvals.data || [],
        transfers: transfers.data || [],
        payables: (payables.data || []).map((p: any) => ({
          id: p.id as string,
          name: p.name as string,
          balance: Number(p.current_balance ?? 0),
        })),
        purchaseOrders: purchaseOrders.data || [],
      };
    },
  });
};

/** Open shifts today — stands in for the attendance summary. */
export const useAttendance = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;
  const since = useMemo(() => startOfToday().toISOString(), []);

  return useQuery({
    queryKey: ['cc', 'attendance', businessId],
    ...common(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cashier_shifts')
        .select('id, cashier_id, opened_at, closed_at, status, expected_cash, actual_cash, cash_discrepancy, branch_id')
        .eq('business_id', businessId!)
        .gte('opened_at', since)
        .order('opened_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      const shifts = data || [];
      const ids = Array.from(new Set(shifts.map((s: any) => s.cashier_id).filter(Boolean)));
      let names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids as string[]);
        names = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email || 'Staff']));
      }
      return shifts.map((s: any) => ({
        id: s.id as string,
        name: names.get(s.cashier_id) || 'Staff',
        openedAt: s.opened_at as string,
        closedAt: s.closed_at as string | null,
        status: s.status as string,
        discrepancy: Number(s.cash_discrepancy ?? 0),
      }));
    },
  });
};

/** Recent activity timeline from the audit trail. */
export const useRecentActivity = () => {
  const { currentBranch } = useBranch();
  const businessId = currentBranch?.business_id;

  return useQuery({
    queryKey: ['cc', 'activity', businessId],
    ...common(businessId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, created_at, user_id')
        .eq('business_id', businessId!)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
  });
};

/** Today's cash flow split by payment method. */
export const useCashFlow = (todaySaleIds: string[]) => {
  const key = todaySaleIds.length;
  return useQuery({
    queryKey: ['cc', 'cashflow', key, todaySaleIds[0] ?? 'none'],
    enabled: todaySaleIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('payment_method, amount, status')
        .in('sale_id', todaySaleIds.slice(0, 500));
      if (error) throw error;
      const map = new Map<string, number>();
      for (const p of (data || []) as any[]) {
        if (p.status && String(p.status).toLowerCase() === 'failed') continue;
        const method = String(p.payment_method || 'other');
        map.set(method, (map.get(method) || 0) + Number(p.amount ?? 0));
      }
      return Array.from(map.entries())
        .map(([method, amount]) => ({ method, amount }))
        .sort((a, b) => b.amount - a.amount);
    },
  });
};

/** Derived, memoised aggregates from the shared 14-day sales window. */
export const useSalesAggregates = (sales: SaleRow[] | undefined) =>
  useMemo(() => {
    const rows = sales || [];
    const todayStart = startOfToday().getTime();
    const yesterdayStart = todayStart - DAY;

    let todayRevenue = 0;
    let todayProfit = 0;
    let todayCount = 0;
    let yesterdayRevenue = 0;
    const todayIds: string[] = [];
    const byBranch = new Map<string, { revenue: number; count: number }>();
    const byDay = new Map<string, number>();

    for (const s of rows) {
      const ts = new Date(s.created_at).getTime();
      const amount = Number(s.total_amount ?? 0);
      const dayKey = new Date(ts).toISOString().slice(0, 10);
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + amount);

      if (ts >= todayStart) {
        todayRevenue += amount;
        todayProfit += Number(s.profit_total ?? 0);
        todayCount += 1;
        todayIds.push(s.id);
        const b = byBranch.get(s.branch_id) || { revenue: 0, count: 0 };
        b.revenue += amount;
        b.count += 1;
        byBranch.set(s.branch_id, b);
      } else if (ts >= yesterdayStart) {
        yesterdayRevenue += amount;
      }
    }

    const trend = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(todayStart - (13 - i) * DAY);
      const key = d.toISOString().slice(0, 10);
      return {
        date: d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }),
        revenue: byDay.get(key) || 0,
      };
    });

    return {
      todayRevenue,
      todayProfit,
      todayCount,
      yesterdayRevenue,
      todayIds,
      trend,
      byBranch,
      averageBasket: todayCount ? todayRevenue / todayCount : 0,
    };
  }, [sales]);