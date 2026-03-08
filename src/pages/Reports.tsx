import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exportToCSV, exportToExcel, exportToPDF, generatePLReport } from '@/lib/export-utils';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import EnhancedCreditAging from '@/components/reports/EnhancedCreditAging';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  Download,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  format, 
  subDays, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  eachHourOfInterval,
} from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type DateRange = 'today' | 'week' | 'month' | 'custom';

const Reports = () => {
  const { currentBranch, branches } = useBranch();
  const { canManageCustomerCredit } = usePermissions();
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch sales data
  const { data: salesData = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', dateRange, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('*, sale_items(*, products(name, category_id, categories(name)))')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('payment_status', 'completed');
      
      if (selectedBranch !== 'all') {
        query = query.eq('branch_id', selectedBranch);
      }
      
      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch payments data
  const { data: paymentsData = [] } = useQuery({
    queryKey: ['payments-report', dateRange, selectedBranch],
    queryFn: async () => {
      const saleIds = salesData.map(s => s.id);
      if (saleIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .in('sale_id', saleIds);
      if (error) throw error;
      return data;
    },
    enabled: salesData.length > 0,
  });

  // Calculate metrics
  const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const totalTransactions = salesData.length;
  const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  
  const totalItemsSold = salesData.reduce((sum, sale) => 
    sum + sale.sale_items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0
  );

  // Previous period comparison
  const previousStart = subDays(start, dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 30);
  const previousEnd = subDays(end, dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 30);

  // Sales by hour/day
  const getSalesChartData = () => {
    if (dateRange === 'today') {
      const hours = eachHourOfInterval({ start, end: new Date() });
      return hours.map(hour => {
        const hourSales = salesData.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate.getHours() === hour.getHours();
        });
        return {
          name: format(hour, 'HH:00'),
          revenue: hourSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
          transactions: hourSales.length,
        };
      });
    } else {
      const days = eachDayOfInterval({ start, end });
      return days.map(day => {
        const daySales = salesData.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return format(saleDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
        });
        return {
          name: format(day, dateRange === 'week' ? 'EEE' : 'MMM d'),
          revenue: daySales.reduce((sum, s) => sum + Number(s.total_amount), 0),
          transactions: daySales.length,
        };
      });
    }
  };

  // Top products
  const getTopProducts = () => {
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    
    salesData.forEach(sale => {
      sale.sale_items.forEach((item: any) => {
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += Number(item.total_amount);
        } else {
          productMap.set(item.product_id, {
            name: item.products?.name || item.product_name,
            quantity: item.quantity,
            revenue: Number(item.total_amount),
          });
        }
      });
    });
    
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  };

  // Sales by category
  const getSalesByCategory = () => {
    const categoryMap = new Map<string, { name: string; revenue: number }>();
    
    salesData.forEach(sale => {
      sale.sale_items.forEach((item: any) => {
        const categoryName = item.products?.categories?.name || 'Uncategorized';
        const existing = categoryMap.get(categoryName);
        if (existing) {
          existing.revenue += Number(item.total_amount);
        } else {
          categoryMap.set(categoryName, {
            name: categoryName,
            revenue: Number(item.total_amount),
          });
        }
      });
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
  };

  // Payment methods breakdown
  const getPaymentBreakdown = () => {
    const methodMap = new Map<string, number>();
    
    paymentsData.forEach(payment => {
      const existing = methodMap.get(payment.payment_method) || 0;
      methodMap.set(payment.payment_method, existing + Number(payment.amount));
    });
    
    return Array.from(methodMap.entries()).map(([method, amount]) => ({
      name: method.charAt(0).toUpperCase() + method.slice(1),
      value: amount,
    }));
  };

  const chartData = getSalesChartData();
  const topProducts = getTopProducts();
  const categoryData = getSalesByCategory();
  const paymentData = getPaymentBreakdown();

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Sales performance, trends, and insights
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[130px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => {
              const period = dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This Week' : 'This Month';
              const topProds = getTopProducts();
              const payBreakdown = getPaymentBreakdown();
              const costOfGoods = salesData.reduce((s, sale) => s + Number(sale.cost_total || 0), 0);
              const grossProfit = totalRevenue - costOfGoods;

              if (v === 'csv') {
                exportToCSV(salesData.map(s => ({
                  Receipt: s.receipt_number,
                  Date: format(new Date(s.created_at), 'dd MMM yyyy HH:mm'),
                  Subtotal: Number(s.subtotal),
                  Tax: Number(s.tax_amount),
                  Discount: Number(s.discount_amount),
                  Total: Number(s.total_amount),
                  Profit: Number(s.profit_total || 0),
                })), `Sales_Report_${period}`);
                toast.success('CSV exported');
              } else if (v === 'excel') {
                exportToExcel(salesData.map(s => ({
                  Receipt: s.receipt_number,
                  Date: format(new Date(s.created_at), 'dd MMM yyyy HH:mm'),
                  Subtotal: Number(s.subtotal),
                  Tax: Number(s.tax_amount),
                  Discount: Number(s.discount_amount),
                  Total: Number(s.total_amount),
                  Cost: Number(s.cost_total || 0),
                  Profit: Number(s.profit_total || 0),
                })), `Sales_Report_${period}`, `Sales Report — ${period}`);
                toast.success('Excel exported');
              } else if (v === 'pdf') {
                const content = generatePLReport({
                  revenue: totalRevenue,
                  costOfGoods,
                  grossProfit,
                  transactionCount: totalTransactions,
                  avgOrderValue: averageOrderValue,
                  dateRange: period,
                  topProducts: topProds,
                  paymentBreakdown: payBreakdown.map(p => ({
                    method: p.name,
                    amount: p.value,
                    count: paymentsData.filter(pay => pay.payment_method.toLowerCase() === p.name.toLowerCase()).length,
                  })),
                });
                exportToPDF(content, `P&L Report — ${period}`);
              }
            }}>
              <SelectTrigger className="w-[130px]">
                <Download className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">Export CSV</SelectItem>
                <SelectItem value="excel">Export Excel</SelectItem>
                <SelectItem value="pdf">P&L Report (PDF)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-success" />
                +12.5% from previous period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-success" />
                +8.2% from previous period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {averageOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-destructive" />
                -2.1% from previous period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItemsSold}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-success" />
                +15.3% from previous period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
            <TabsTrigger value="products">Top Products</TabsTrigger>
            <TabsTrigger value="categories">By Category</TabsTrigger>
            <TabsTrigger value="payments">Payment Methods</TabsTrigger>
            {canManageCustomerCredit && (
              <TabsTrigger value="credit" className="gap-1">
                <CreditCard className="w-4 h-4" />
                Credit Aging
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="revenue">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={120}
                        tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? `KES ${value.toLocaleString()}` : value,
                          name === 'revenue' ? 'Revenue' : 'Quantity'
                        ]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sales by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="revenue"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryData.map((category, index) => (
                      <div key={category.name} className="flex items-center gap-4">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">{category.name}</span>
                            <span className="text-sm text-muted-foreground">
                              KES {category.revenue.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full"
                              style={{ 
                                width: `${(category.revenue / totalRevenue) * 100}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {paymentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Amount']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paymentData.map((method, index) => (
                      <div key={method.name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${COLORS[index % COLORS.length]}20`, color: COLORS[index % COLORS.length] }}
                          >
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{method.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {((method.value / totalRevenue) * 100).toFixed(1)}% of total
                            </p>
                          </div>
                        </div>
                        <p className="font-bold">KES {method.value.toLocaleString()}</p>
                      </div>
                    ))}
                    {paymentData.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No payment data available
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {canManageCustomerCredit && (
            <TabsContent value="credit">
              <EnhancedCreditAging />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
