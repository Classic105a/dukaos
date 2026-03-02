import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProfitIntelligence = () => {
  const { currentBranch } = useBranch();

  const { data: profitData, isLoading } = useQuery({
    queryKey: ['profit-intelligence', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return null;

      // Fetch products with cost prices
      const { data: products } = await supabase
        .from('products')
        .select('id, name, unit_price, cost_price, sku')
        .or(`branch_id.eq.${currentBranch.id},is_shared_product.eq.true`)
        .eq('is_active', true);

      // Fetch current stock
      const { data: stock } = await supabase
        .from('current_stock')
        .select('product_id, quantity')
        .eq('branch_id', currentBranch.id);

      // Fetch recent sales (last 30 days) for weighted average
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('product_id, quantity, unit_price, total_amount, sale_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const stockMap = new Map((stock || []).map(s => [s.product_id, s.quantity || 0]));
      const salesByProduct = new Map<string, { totalQty: number; totalRevenue: number }>();
      
      (saleItems || []).forEach(item => {
        const existing = salesByProduct.get(item.product_id) || { totalQty: 0, totalRevenue: 0 };
        existing.totalQty += item.quantity;
        existing.totalRevenue += item.total_amount;
        salesByProduct.set(item.product_id, existing);
      });

      let totalPurchaseValue = 0;
      let totalSalesValue = 0;
      let totalStockValue = 0;
      let totalCostOfStock = 0;

      const productProfits = (products || []).map(p => {
        const qty = stockMap.get(p.id) || 0;
        const costPrice = p.cost_price || 0;
        const sellingPrice = p.unit_price;
        const margin = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;
        const sales = salesByProduct.get(p.id);
        const unitsSold = sales?.totalQty || 0;
        const revenue = sales?.totalRevenue || 0;
        const costOfGoodsSold = unitsSold * costPrice;
        const profit = revenue - costOfGoodsSold;

        totalStockValue += qty * sellingPrice;
        totalCostOfStock += qty * costPrice;
        totalSalesValue += revenue;
        totalPurchaseValue += costOfGoodsSold;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          costPrice,
          sellingPrice,
          margin,
          qty,
          unitsSold,
          revenue,
          profit,
        };
      });

      // Sort by profit descending
      productProfits.sort((a, b) => b.profit - a.profit);

      return {
        products: productProfits,
        totalStockValue,
        totalCostOfStock,
        totalSalesValue,
        totalPurchaseValue,
        totalProfit: totalSalesValue - totalPurchaseValue,
        potentialProfit: totalStockValue - totalCostOfStock,
      };
    },
    enabled: !!currentBranch?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profitData) return null;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Sales Value (30d)</span>
            </div>
            <p className="text-lg font-bold">KES {profitData.totalSalesValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Purchase Value (30d)</span>
            </div>
            <p className="text-lg font-bold text-destructive">KES {profitData.totalPurchaseValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={cn(profitData.totalProfit >= 0 ? 'border-success/30' : 'border-destructive/30')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {profitData.totalProfit >= 0 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              <span className="text-xs text-muted-foreground">Net Profit (30d)</span>
            </div>
            <p className={cn('text-lg font-bold', profitData.totalProfit >= 0 ? 'text-success' : 'text-destructive')}>
              KES {profitData.totalProfit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Stock Value</span>
            </div>
            <p className="text-lg font-bold">KES {profitData.totalStockValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Cost: KES {profitData.totalCostOfStock.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Product Profit Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Product Profit Breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Cost</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Selling</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Margin</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Sold (30d)</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Profit (30d)</th>
              </tr>
            </thead>
            <tbody>
              {profitData.products.slice(0, 20).map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3">
                    <p className="font-medium">{p.name}</p>
                    {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
                  </td>
                  <td className="text-right p-3">KES {p.costPrice.toLocaleString()}</td>
                  <td className="text-right p-3">KES {p.sellingPrice.toLocaleString()}</td>
                  <td className="text-right p-3">
                    <Badge variant="outline" className={cn(
                      'text-xs',
                      p.margin >= 30 ? 'border-success/50 text-success' :
                      p.margin >= 10 ? 'border-warning/50 text-warning' :
                      'border-destructive/50 text-destructive'
                    )}>
                      {p.margin.toFixed(1)}%
                    </Badge>
                  </td>
                  <td className="text-right p-3">{p.unitsSold}</td>
                  <td className={cn('text-right p-3 font-medium', p.profit >= 0 ? 'text-success' : 'text-destructive')}>
                    KES {p.profit.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ProfitIntelligence;
