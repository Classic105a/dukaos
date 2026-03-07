import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Users, DollarSign, Phone, Download, TrendingDown, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type AgingBucket = '0-7' | '8-30' | '31-60' | '60-90' | '90+';

interface AgingCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  credit_balance: number;
  credit_limit: number;
  daysSinceOldest: number;
  ageCategory: AgingBucket;
  riskScore: number;
  estimatedPenalty: number;
}

const PENALTY_RATE_MONTHLY = 0.02; // 2% per month

const EnhancedCreditAging = () => {
  const navigate = useNavigate();

  const { data: agingData, isLoading } = useQuery({
    queryKey: ['enhanced-credit-aging'],
    queryFn: async () => {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('credit_enabled', true)
        .gt('credit_balance', 0);
      if (error) throw error;

      const result: AgingCustomer[] = await Promise.all(
        (customers || []).map(async (customer) => {
          const { data: transactions } = await supabase
            .from('credit_transactions')
            .select('created_at')
            .eq('customer_id', customer.id)
            .eq('transaction_type', 'CREDIT_SALE')
            .order('created_at', { ascending: true })
            .limit(1);

          const oldestDate = transactions?.[0]?.created_at;
          const daysSince = oldestDate
            ? Math.floor((Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          let ageCategory: AgingBucket = '0-7';
          if (daysSince > 90) ageCategory = '90+';
          else if (daysSince > 60) ageCategory = '60-90';
          else if (daysSince > 30) ageCategory = '31-60';
          else if (daysSince > 7) ageCategory = '8-30';

          const balance = Number(customer.credit_balance);
          const limit = Number(customer.credit_limit);
          const utilization = limit > 0 ? balance / limit : 1;

          // Risk score: 0-100 based on utilization + days overdue
          const utilizationScore = Math.min(utilization, 1) * 40;
          const ageScore = Math.min(daysSince / 90, 1) * 60;
          const riskScore = Math.round(utilizationScore + ageScore);

          // Penalty interest calc
          const monthsOverdue = Math.max(0, (daysSince - 30) / 30);
          const estimatedPenalty = monthsOverdue > 0 ? balance * PENALTY_RATE_MONTHLY * monthsOverdue : 0;

          return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            credit_balance: balance,
            credit_limit: limit,
            daysSinceOldest: daysSince,
            ageCategory,
            riskScore,
            estimatedPenalty,
          };
        })
      );

      return result.sort((a, b) => b.riskScore - a.riskScore);
    },
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const customers = agingData || [];
  const totalOutstanding = customers.reduce((s, c) => s + c.credit_balance, 0);
  const totalPenalty = customers.reduce((s, c) => s + c.estimatedPenalty, 0);

  const buckets: { key: AgingBucket; label: string; color: string; icon: any }[] = [
    { key: '0-7', label: '0-7 Days', color: 'text-success', icon: Clock },
    { key: '8-30', label: '8-30 Days', color: 'text-info', icon: Clock },
    { key: '31-60', label: '31-60 Days', color: 'text-warning', icon: AlertTriangle },
    { key: '60-90', label: '60-90 Days', color: 'text-destructive', icon: AlertTriangle },
    { key: '90+', label: '90+ Days', color: 'text-destructive', icon: ShieldAlert },
  ];

  const getBucketCustomers = (key: AgingBucket) => customers.filter(c => c.ageCategory === key);
  const getBucketTotal = (key: AgingBucket) => getBucketCustomers(key).reduce((s, c) => s + c.credit_balance, 0);

  const getRiskBadge = (score: number) => {
    if (score >= 70) return { label: 'Critical', variant: 'destructive' as const };
    if (score >= 50) return { label: 'High', variant: 'destructive' as const };
    if (score >= 30) return { label: 'Medium', variant: 'secondary' as const };
    return { label: 'Low', variant: 'default' as const };
  };

  const exportCSV = () => {
    const headers = ['Customer', 'Phone', 'Balance', 'Limit', 'Days', 'Category', 'Risk Score', 'Penalty Interest'];
    const rows = customers.map(c => [c.name, c.phone || '', c.credit_balance, c.credit_limit, c.daysSinceOldest, c.ageCategory, c.riskScore, c.estimatedPenalty.toFixed(2)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-aging-enhanced-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="col-span-2 lg:col-span-1 border-destructive/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Exposure</p>
            <p className="text-xl font-bold text-destructive tabular-nums mt-1">KES {totalOutstanding.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{customers.length} customers</p>
          </CardContent>
        </Card>
        {buckets.map(b => {
          const Icon = b.icon;
          const total = getBucketTotal(b.key);
          const count = getBucketCustomers(b.key).length;
          return (
            <Card key={b.key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn('w-3.5 h-3.5', b.color)} />
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                </div>
                <p className="text-lg font-bold tabular-nums">KES {total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{count} customer{count !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Penalty Summary */}
      {totalPenalty > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Estimated Penalty Interest (2% monthly)</p>
                <p className="text-xs text-muted-foreground">On balances overdue more than 30 days</p>
              </div>
            </div>
            <p className="text-lg font-bold text-warning tabular-nums">KES {totalPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customer Risk Assessment
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No outstanding credit balances</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead className="text-center">Aging</TableHead>
                    <TableHead className="text-center">Risk</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(c => {
                    const risk = getRiskBadge(c.riskScore);
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-destructive">KES {c.credit_balance.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">KES {c.credit_limit.toLocaleString()}</TableCell>
                        <TableCell className="text-center tabular-nums">{c.daysSinceOldest}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{c.ageCategory}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={risk.variant} className="text-xs">{risk.label} ({c.riskScore})</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-warning font-medium">
                          {c.estimatedPenalty > 0 ? `KES ${c.estimatedPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/customers/${c.id}/statement`)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedCreditAging;
