import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, TrendingDown, TrendingUp, Package,
  ShoppingCart, BarChart3, RefreshCw, Bell, Zap, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SmartInventory = () => {
  const { currentBranch } = useBranch();

  const { data: products } = useQuery({
    queryKey: ['smart-inventory-products', currentBranch?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, cost_price, unit_price, low_stock_threshold, track_inventory, category_id, categories(name)')
        .eq('is_active', true);
      return data || [];
    },
  });

  const { data: stockData } = useQuery({
    queryKey: ['smart-inventory-stock', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const { data } = await supabase
        .from('current_stock')
        .select('*')
        .eq('branch_id', currentBranch.id);
      return data || [];
    },
    enabled: !!currentBranch?.id,
  });

  const { data: recentSales } = useQuery({
    queryKey: ['smart-inventory-sales', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('sale_items')
        .select('product_id, quantity, created_at, sales!inner(branch_id)')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('sales.branch_id', currentBranch.id);
      return data || [];
    },
    enabled: !!currentBranch?.id,
  });

  const { data: reorderRules } = useQuery({
    queryKey: ['reorder-rules', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const { data } = await supabase
        .from('reorder_rules')
        .select('*, parties(name)')
        .eq('branch_id', currentBranch.id);
      return data || [];
    },
    enabled: !!currentBranch?.id,
  });

  const inventory = useMemo(() => {
    if (!products || !stockData) return [];

    const salesByProduct: Record<string, number> = {};
    recentSales?.forEach(s => {
      salesByProduct[s.product_id] = (salesByProduct[s.product_id] || 0) + s.quantity;
    });

    return products.map(product => {
      const stock = stockData.find(s => s.product_id === product.id);
      const currentQty = stock?.quantity || 0;
      const threshold = product.low_stock_threshold || 10;
      const monthlySales = salesByProduct[product.id] || 0;
      const dailyAvg = monthlySales / 30;
      const daysOfStock = dailyAvg > 0 ? Math.round(currentQty / dailyAvg) : currentQty > 0 ? 999 : 0;
      const rule = reorderRules?.find(r => r.product_id === product.id);
      const reorderPoint = rule?.reorder_point || threshold;
      const suggestedReorder = rule?.reorder_quantity || Math.max(Math.round(dailyAvg * 30), threshold * 2);
      const stockLevel = currentQty <= 0 ? 'out' : currentQty <= reorderPoint ? 'low' : currentQty <= reorderPoint * 2 ? 'medium' : 'healthy';
      const stockValue = currentQty * (product.cost_price || 0);

      return {
        ...product,
        currentQty,
        threshold,
        monthlySales,
        dailyAvg: Math.round(dailyAvg * 10) / 10,
        daysOfStock,
        reorderPoint,
        suggestedReorder,
        stockLevel,
        stockValue,
        categoryName: (product as any).categories?.name || 'Uncategorized',
      };
    }).sort((a, b) => a.daysOfStock - b.daysOfStock);
  }, [products, stockData, recentSales, reorderRules]);

  const outOfStock = inventory.filter(i => i.stockLevel === 'out');
  const lowStock = inventory.filter(i => i.stockLevel === 'low');
  const needsReorder = inventory.filter(i => i.currentQty <= i.reorderPoint && i.currentQty > 0);
  const totalStockValue = inventory.reduce((s, i) => s + i.stockValue, 0);
  const topMovers = [...inventory].sort((a, b) => b.monthlySales - a.monthlySales).slice(0, 5);
  const slowMovers = inventory.filter(i => i.currentQty > 0 && i.monthlySales === 0);

  const stockLevelColor = (level: string) => {
    const map: Record<string, string> = {
      out: 'bg-destructive/10 text-destructive',
      low: 'bg-warning/10 text-warning',
      medium: 'bg-info/10 text-info',
      healthy: 'bg-success/10 text-success',
    };
    return map[level] || '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-display font-bold">Smart Inventory</h1>
          <p className="text-sm text-muted-foreground">Demand forecasting, reorder alerts & stock intelligence</p>
        </div>

        {/* Alert Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Out of Stock</p>
                <p className="text-xl font-bold">{outOfStock.length}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Low Stock Alerts</p>
                <p className="text-xl font-bold">{lowStock.length}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Needs Reorder</p>
                <p className="text-xl font-bold">{needsReorder.length}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Stock Value</p>
                <p className="text-xl font-bold">KES {totalStockValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Top Movers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />Fast Movers (30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topMovers.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </div>
                  <Badge className="bg-success/10 text-success shrink-0">{item.monthlySales} sold</Badge>
                </div>
              ))}
              {topMovers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No sales data yet</p>}
            </CardContent>
          </Card>

          {/* Slow Movers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-warning" />Dead Stock (0 sales in 30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {slowMovers.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.currentQty} in stock</span>
                </div>
              ))}
              {slowMovers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All products moving</p>}
              {slowMovers.length > 5 && <p className="text-xs text-muted-foreground text-center">+{slowMovers.length - 5} more</p>}
            </CardContent>
          </Card>

          {/* Reorder Suggestions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />Auto-Reorder Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {needsReorder.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">{item.name}</span>
                    <span className="text-2xs text-muted-foreground">{item.currentQty} left · {item.daysOfStock}d supply</span>
                  </div>
                  <Badge className="bg-primary/10 text-primary shrink-0">Order {item.suggestedReorder}</Badge>
                </div>
              ))}
              {needsReorder.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All stocked up</p>}
            </CardContent>
          </Card>
        </div>

        {/* Full Inventory Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Stock Intelligence Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">30d Sales</TableHead>
                    <TableHead className="text-right">Daily Avg</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.slice(0, 50).map(item => (
                    <TableRow key={item.id} className={cn(item.stockLevel === 'out' && 'bg-destructive/5')}>
                      <TableCell className="font-medium text-sm">{item.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.categoryName}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{item.currentQty}</TableCell>
                      <TableCell><Badge className={stockLevelColor(item.stockLevel)}>{item.stockLevel}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{item.monthlySales}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.dailyAvg}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.daysOfStock === 999 ? '∞' : `${item.daysOfStock}d`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">KES {item.stockValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SmartInventory;
