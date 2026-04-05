import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import CreditPaymentDialog from '@/components/customers/CreditPaymentDialog';
import {
  ArrowLeft,
  Download,
  CreditCard,
  Wallet,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  MapPin,
  FileText,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const CustomerStatement = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { useCreditHistory } = useCustomerCredit();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Fetch customer
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Credit history
  const { data: history = [], isLoading: historyLoading } = useCreditHistory(customerId || '');

  // Fetch sales for this customer (for invoice detail)
  const { data: customerSales = [] } = useQuery({
    queryKey: ['customer-statement-sales', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, receipt_number, total_amount, subtotal, tax_amount, discount_amount, created_at, branch_id, branches(name), sale_items(product_name, quantity, unit_price, total_amount, discount_amount, tax_amount)')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  if (customerLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Customer not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/customers')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const balance = Number(customer.credit_balance || 0);
  const limit = Number(customer.credit_limit || 0);
  const available = Math.max(0, limit - balance);
  const usedPct = limit > 0 ? (balance / limit) * 100 : 0;

  // Get oldest unpaid date for overdue calc
  const oldestCreditSale = history
    .filter(h => h.transaction_type === 'CREDIT_SALE')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const daysOverdue = oldestCreditSale
    ? Math.floor((Date.now() - new Date(oldestCreditSale.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const getAgingBucket = (days: number) => {
    if (days <= 7) return { label: '0-7 days', color: 'bg-success/10 text-success border-success/30' };
    if (days <= 30) return { label: '8-30 days', color: 'bg-info/10 text-info border-info/30' };
    if (days <= 60) return { label: '31-60 days', color: 'bg-warning/10 text-warning border-warning/30' };
    if (days <= 90) return { label: '60-90 days', color: 'bg-destructive/10 text-destructive border-destructive/30' };
    return { label: '90+ days', color: 'bg-destructive text-destructive-foreground' };
  };

  const txTypeLabel = (type: string) => {
    switch (type) {
      case 'CREDIT_SALE': return 'Invoice';
      case 'PAYMENT': return 'Payment';
      case 'ADJUSTMENT': return 'Adjustment';
      case 'REFUND': return 'Credit Note';
      default: return type;
    }
  };

  const txTypeBadge = (type: string) => {
    switch (type) {
      case 'CREDIT_SALE': return 'destructive' as const;
      case 'PAYMENT': return 'default' as const;
      case 'ADJUSTMENT': return 'secondary' as const;
      case 'REFUND': return 'outline' as const;
      default: return 'secondary' as const;
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Reference', 'Amount', 'Running Balance', 'Notes'];
    const rows = history.map(h => [
      format(new Date(h.created_at), 'yyyy-MM-dd HH:mm'),
      txTypeLabel(h.transaction_type),
      h.reference || h.sale_id || '',
      Number(h.amount),
      Number(h.running_balance),
      h.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${customer.name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const aging = balance > 0 ? getAgingBucket(daysOverdue) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Back + Title */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">Account Statement & Ledger</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
            {balance > 0 && (
              <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                <CreditCard className="w-4 h-4 mr-1.5" />
                Record Payment
              </Button>
            )}
          </div>
        </div>

        {/* Statement Header — Key Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Outstanding Balance — Large */}
          <Card className={cn('lg:col-span-2 relative overflow-hidden', balance > 0 ? 'border-destructive/30' : 'border-success/30')}>
            <CardContent className="p-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Outstanding Balance</p>
              <p className={cn('text-4xl font-bold tabular-nums', balance > 0 ? 'text-destructive' : 'text-success')}>
                KES {balance.toLocaleString()}
              </p>
              {balance > 0 && aging && (
                <Badge variant="outline" className={cn('mt-3', aging.color)}>
                  <Clock className="w-3 h-3 mr-1" />
                  {aging.label} overdue
                </Badge>
              )}
              {balance === 0 && (
                <Badge variant="outline" className="mt-3 bg-success/10 text-success border-success/30">
                  Account Clear
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Credit Limit</p>
              <p className="text-2xl font-bold tabular-nums">KES {limit.toLocaleString()}</p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', usedPct > 80 ? 'bg-destructive' : usedPct > 50 ? 'bg-warning' : 'bg-success')} style={{ width: `${Math.min(usedPct, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{usedPct.toFixed(0)}% utilized</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Available Credit</p>
              <p className="text-2xl font-bold tabular-nums text-success">KES {available.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-2">Remaining balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="space-y-2 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{customer.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Since {format(new Date(customer.created_at), 'MMM yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Ledger */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Transaction Ledger
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {history.length} entries
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map(tx => {
                      const amount = Number(tx.amount);
                      const isDebit = amount > 0;
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs tabular-nums">
                            {format(new Date(tx.created_at), 'dd MMM yyyy')}
                            <br />
                            <span className="text-muted-foreground">{format(new Date(tx.created_at), 'HH:mm')}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={txTypeBadge(tx.transaction_type)} className="text-xs">
                              {txTypeLabel(tx.transaction_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tx.reference || tx.payment_method || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {tx.notes || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {isDebit ? (
                              <span className="text-destructive">KES {Math.abs(amount).toLocaleString()}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {!isDebit ? (
                              <span className="text-success">KES {Math.abs(amount).toLocaleString()}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            KES {Number(tx.running_balance).toLocaleString()}
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

        {/* Recent Invoices with Item Detail */}
        {customerSales.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Recent Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                {customerSales.slice(0, 10).map(sale => (
                  <div key={sale.id} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold">{sale.receipt_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sale.created_at), 'dd MMM yyyy HH:mm')}
                          {(sale as any).branches?.name && ` • ${(sale as any).branches.name}`}
                        </p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">KES {Number(sale.total_amount).toLocaleString()}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-1 font-medium text-muted-foreground">Item</th>
                            <th className="text-right py-1 font-medium text-muted-foreground">Qty</th>
                            <th className="text-right py-1 font-medium text-muted-foreground">Price</th>
                            <th className="text-right py-1 font-medium text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.sale_items.map((item: any, i: number) => (
                            <tr key={i} className="border-b border-border/30 last:border-0">
                              <td className="py-1">{item.product_name}</td>
                              <td className="py-1 text-right tabular-nums">{item.quantity}</td>
                              <td className="py-1 text-right tabular-nums">KES {Number(item.unit_price).toLocaleString()}</td>
                              <td className="py-1 text-right tabular-nums font-medium">KES {Number(item.total_amount).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end gap-4 mt-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
                      <span>Subtotal: KES {Number(sale.subtotal).toLocaleString()}</span>
                      {Number(sale.tax_amount) > 0 && <span>Tax: KES {Number(sale.tax_amount).toLocaleString()}</span>}
                      {Number(sale.discount_amount) > 0 && <span>Discount: KES {Number(sale.discount_amount).toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <CreditPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          customer={customer ? {
            id: customer.id,
            name: customer.name,
            credit_limit: Number(customer.credit_limit),
            credit_balance: Number(customer.credit_balance),
          } : null}
        />
      </div>
    </DashboardLayout>
  );
};

export default CustomerStatement;
