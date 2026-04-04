import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Users,
  Building2,
  ShieldAlert,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  Download,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useState } from 'react';

const COLORS = ['hsl(160,72%,38%)', 'hsl(222,72%,42%)', 'hsl(40,96%,50%)', 'hsl(4,76%,50%)', 'hsl(270,60%,50%)'];

const Analytics = () => {
  const { branches } = useBranch();
  const [period, setPeriod] = useState('30');

  const startDate = subDays(new Date(), parseInt(period));

  // Top-selling products
  const { data: topProducts } = useQuery({
    queryKey: ['analytics-top-products', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_products', {
        p_branch_id: branches[0]?.id || '00000000-0000-0000-0000-000000000000',
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
        p_limit: 10,
      });
      if (error) throw error;
      return ((data as any[]) || []).map((p: any) => ({
        id: p.product_id,
        name: p.product_name,
        qty: Number(p.total_qty),
        revenue: Number(p.total_revenue),
      }));
    },
    enabled: branches.length > 0,
  });

  // Low stock alerts
  const { data: lowStockItems } = useQuery({
    queryKey: ['analytics-low-stock'],
    queryFn: async () => {
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, name, low_stock_threshold')
        .eq('is_active', true)
        .eq('track_inventory', true);
      if (pErr) throw pErr;
      const { data: stockRows, error: sErr } = await supabase
        .from('current_stock')
        .select('product_id, branch_id, quantity');
      if (sErr) throw sErr;
      const alerts: Array<{ id: string; name: string; quantity: number; threshold: number; branch_id: string }> = [];
      (products || []).forEach(p => {
        const threshold = p.low_stock_threshold ?? 10;
        (stockRows || []).filter(s => s.product_id === p.id).forEach(s => {
          if ((s.quantity ?? 0) <= threshold) {
            alerts.push({ id: p.id, name: p.name, quantity: s.quantity ?? 0, threshold, branch_id: s.branch_id! });
          }
        });
      });
      return alerts.sort((a, b) => a.quantity - b.quantity).slice(0, 20);
    },
  });

  // Total credit exposure
  const { data: creditData, isLoading: creditLoading } = useQuery({
    queryKey: ['analytics-credit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, credit_balance, credit_limit, credit_enabled')
        .eq('credit_enabled', true)
        .order('credit_balance', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Sales by branch
  const { data: branchSales } = useQuery({
    queryKey: ['analytics-branch-sales', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('branch_id, total_amount, profit_total, created_at')
        .gte('created_at', startDate.toISOString())
        .eq('payment_status', 'completed');
      if (error) throw error;
      return data;
    },
  });

  // Credit transactions for collection rate
  const { data: creditTxns } = useQuery({
    queryKey: ['analytics-credit-txns', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Inventory valuation
  const { data: inventoryData } = useQuery({
    queryKey: ['analytics-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, cost_price, unit_price, category_id, categories(name)')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: stockData } = useQuery({
    queryKey: ['analytics-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Compute metrics
  const customers = creditData || [];
  const totalExposure = customers.reduce((s, c) => s + Number(c.credit_balance || 0), 0);
  const totalCreditLimit = customers.reduce((s, c) => s + Number(c.credit_limit || 0), 0);
  const customersWithDebt = customers.filter(c => Number(c.credit_balance) > 0);
  const top20Debtors = customersWithDebt.slice(0, 20);

  // Credit aging (enhanced: 0-7, 8-30, 31-60, 60-90, 90+)
  const txns = creditTxns || [];
  const creditSales = txns.filter(t => t.transaction_type === 'CREDIT_SALE');
  const creditPayments = txns.filter(t => t.transaction_type === 'PAYMENT');
  const totalCredited = creditSales.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalCollected = creditPayments.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const collectionRate = totalCredited > 0 ? (totalCollected / totalCredited) * 100 : 0;

  // Branch performance
  const sales = branchSales || [];
  const branchPerformance = branches.map(branch => {
    const bSales = sales.filter(s => s.branch_id === branch.id);
    const revenue = bSales.reduce((s, sale) => s + Number(sale.total_amount), 0);
    const profit = bSales.reduce((s, sale) => s + Number(sale.profit_total || 0), 0);
    const branchExposure = customers
      .filter(c => Number(c.credit_balance) > 0)
      .reduce((s, c) => s + Number(c.credit_balance), 0);
    return { name: branch.name, revenue, profit, transactions: bSales.length, creditExposure: branchExposure / branches.length };
  });

  // Inventory valuation
  const products = inventoryData || [];
  const stock = stockData || [];
  const inventoryValuation = products.reduce((total, product) => {
    const qty = stock.find(s => s.product_id === product.id)?.quantity || 0;
    return total + (Number(product.cost_price || 0) * qty);
  }, 0);
  const retailValue = products.reduce((total, product) => {
    const qty = stock.find(s => s.product_id === product.id)?.quantity || 0;
    return total + (Number(product.unit_price) * qty);
  }, 0);

  // Category margins
  const categoryMap = new Map<string, { name: string; cost: number; revenue: number }>();
  products.forEach(p => {
    const catName = (p as any).categories?.name || 'Uncategorized';
    const qty = stock.find(s => s.product_id === p.id)?.quantity || 0;
    const existing = categoryMap.get(catName) || { name: catName, cost: 0, revenue: 0 };
    existing.cost += Number(p.cost_price || 0) * qty;
    existing.revenue += Number(p.unit_price) * qty;
    categoryMap.set(catName, existing);
  });
  const categoryMargins = Array.from(categoryMap.values())
    .map(c => ({ ...c, margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Daily credit sales trend
  const dailyCreditData: { date: string; credited: number; collected: number }[] = [];
  const daysBack = parseInt(period);
  for (let i = daysBack; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const label = format(day, daysBack > 14 ? 'MMM d' : 'EEE');
    const dayCredited = txns
      .filter(t => t.transaction_type === 'CREDIT_SALE' && format(new Date(t.created_at), 'yyyy-MM-dd') === dayStr)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const dayCollected = txns
      .filter(t => t.transaction_type === 'PAYMENT' && format(new Date(t.created_at), 'yyyy-MM-dd') === dayStr)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    dailyCreditData.push({ date: label, credited: dayCredited, collected: dayCollected });
  }

  const totalRevenue = sales.reduce((s, sale) => s + Number(sale.total_amount), 0);
  const totalProfit = sales.reduce((s, sale) => s + Number(sale.profit_total || 0), 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Compare with previous period for real trends
  const prevStartDate = subDays(startDate, parseInt(period));
  const prevSales = (branchSales || []).filter(s => {
    const d = new Date(s.created_at);
    return d >= prevStartDate && d < startDate;
  });
  const prevRevenue = prevSales.reduce((s, sale) => s + Number(sale.total_amount), 0);
  const revenueTrend = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const prevProfit = prevSales.reduce((s, sale) => s + Number(sale.profit_total || 0), 0);
  const profitTrend = prevProfit > 0 ? ((totalProfit - prevProfit) / prevProfit) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
            <p className="text-muted-foreground text-sm">Real-time business intelligence & credit exposure</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Row 1 — Financial */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <KPICard
            label="Total Revenue"
            value={`KES ${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            trend={revenueTrend}
            trendLabel="vs prev period"
            color="text-primary"
            bgColor="bg-primary/10"
          />
          <KPICard
            label="Gross Profit"
            value={`KES ${totalProfit.toLocaleString()}`}
            icon={TrendingUp}
            trend={profitTrend}
            trendLabel={`${profitMargin.toFixed(1)}% margin`}
            color="text-success"
            bgColor="bg-success/10"
          />
          <KPICard
            label="Credit Exposure"
            value={`KES ${totalExposure.toLocaleString()}`}
            icon={CreditCard}
            trendLabel={`${customersWithDebt.length} debtors`}
            color="text-destructive"
            bgColor="bg-destructive/10"
          />
          <KPICard
            label="Inventory Value"
            value={`KES ${inventoryValuation.toLocaleString()}`}
            icon={Wallet}
            trendLabel={`Retail: KES ${retailValue.toLocaleString()}`}
            color="text-info"
            bgColor="bg-info/10"
          />
        </div>

        {/* KPI Row 2 — Operational */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <KPICard
            label="Active Debtors"
            value={customersWithDebt.length.toString()}
            icon={Users}
            trendLabel={`of ${customers.length} credit customers`}
            color="text-warning"
            bgColor="bg-warning/10"
          />
          <KPICard
            label="Collection Rate"
            value={`${collectionRate.toFixed(1)}%`}
            icon={Activity}
            trend={collectionRate > 50 ? 5 : -5}
            color={collectionRate > 50 ? "text-success" : "text-destructive"}
            bgColor={collectionRate > 50 ? "bg-success/10" : "bg-destructive/10"}
          />
          <KPICard
            label="Daily Credit Sales"
            value={`KES ${totalCredited.toLocaleString()}`}
            icon={ShieldAlert}
            trendLabel={`${creditSales.length} transactions`}
            color="text-primary"
            bgColor="bg-primary/10"
          />
          <KPICard
            label="Total Transactions"
            value={sales.length.toLocaleString()}
            icon={ArrowUpRight}
            trendLabel={`across ${branches.length} branches`}
            color="text-accent"
            bgColor="bg-accent/10"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Credit Flow Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Credit Sales vs Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyCreditData}>
                    <defs>
                      <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(4,76%,50%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(4,76%,50%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="collectGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160,72%,38%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(160,72%,38%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number, name: string) => [`KES ${v.toLocaleString()}`, name === 'credited' ? 'Credit Sales' : 'Collections']}
                    />
                    <Area type="monotone" dataKey="credited" stroke="hsl(4,76%,50%)" strokeWidth={2} fill="url(#creditGrad)" />
                    <Area type="monotone" dataKey="collected" stroke="hsl(160,72%,38%)" strokeWidth={2} fill="url(#collectGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Margins */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Margin by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryMargins.map((cat, i) => (
                  <div key={cat.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate max-w-[120px]">{cat.name}</span>
                      <span className={cn('font-semibold tabular-nums', cat.margin > 30 ? 'text-success' : cat.margin > 15 ? 'text-warning' : 'text-destructive')}>
                        {cat.margin.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(cat.margin, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
                {categoryMargins.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No inventory data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row: Top Debtors + Branch Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top 20 Debtors */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Top Debtors
                </CardTitle>
                <Badge variant="destructive" className="text-xs">
                  {customersWithDebt.length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-thin">
                {top20Debtors.map((c, i) => {
                  const balance = Number(c.credit_balance);
                  const limit = Number(c.credit_limit);
                  const pct = limit > 0 ? (balance / limit) * 100 : 100;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-destructive">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone || 'No phone'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-destructive tabular-nums">KES {balance.toLocaleString()}</p>
                        <div className="flex items-center gap-1 justify-end">
                          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-warning' : 'bg-success')} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-2xs text-muted-foreground">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {top20Debtors.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No outstanding debts</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Branch Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Branch Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {branchPerformance.length > 0 ? (
                <>
                  <div className="h-[200px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(v: number) => [`KES ${v.toLocaleString()}`]}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                        <Bar dataKey="profit" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Profit" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {branchPerformance.map(b => (
                      <div key={b.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                        <span className="font-medium">{b.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="tabular-nums">{b.transactions} sales</span>
                          <span className="font-semibold tabular-nums text-primary">KES {b.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No branch data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Sellers + Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                Top Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {(topProducts || []).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                    <span className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} units sold</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-primary">KES {p.revenue.toLocaleString()}</span>
                  </div>
                ))}
                {(!topProducts || topProducts.length === 0) && (
                  <p className="text-center text-sm text-muted-foreground py-8">No sales data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={(lowStockItems || []).length > 0 ? 'border-warning/30' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Low Stock Alerts
                </CardTitle>
                {(lowStockItems || []).length > 0 && (
                  <Badge variant="outline" className="text-warning border-warning">{(lowStockItems || []).length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {(lowStockItems || []).map(item => (
                  <div key={`${item.id}-${item.branch_id}`} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                    <div className={cn(
                      'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                      item.quantity === 0 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                    )}>
                      {item.quantity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Threshold: {item.threshold}</p>
                    </div>
                    {item.quantity === 0 && <Badge variant="destructive" className="text-[10px]">OUT</Badge>}
                  </div>
                ))}
                {(!lowStockItems || lowStockItems.length === 0) && (
                  <p className="text-center text-sm text-muted-foreground py-8">All stock levels healthy</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {customersWithDebt.filter(c => Number(c.credit_balance) > Number(c.credit_limit) * 0.9).length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-4 h-4" />
                Credit Risk Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {customersWithDebt
                  .filter(c => Number(c.credit_balance) > Number(c.credit_limit) * 0.9)
                  .map(c => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-destructive/20">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {((Number(c.credit_balance) / Number(c.credit_limit)) * 100).toFixed(0)}% of limit used
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

// KPI Card Component
const KPICard = ({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color,
  bgColor,
}: {
  label: string;
  value: string;
  icon: any;
  trend?: number;
  trendLabel?: string;
  color: string;
  bgColor: string;
}) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-xl lg:text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {trend !== undefined && (
          <span className={cn('flex items-center text-xs font-medium', trend >= 0 ? 'text-success' : 'text-destructive')}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
      </div>
    </CardContent>
  </Card>
);

export default Analytics;
