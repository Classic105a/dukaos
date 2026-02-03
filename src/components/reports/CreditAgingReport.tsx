import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Users, DollarSign, Phone, Mail, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const CreditAgingReport = () => {
  const { useCreditAging } = useCustomerCredit();
  const { data: agingData, isLoading, error } = useCreditAging();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-2" />
          <p className="text-muted-foreground">Failed to load credit aging data</p>
        </CardContent>
      </Card>
    );
  }

  const customers = agingData || [];
  
  // Calculate summary stats
  const totalOutstanding = customers.reduce((sum, c) => sum + Number(c.credit_balance), 0);
  const customersWithDebt = customers.filter(c => Number(c.credit_balance) > 0);
  
  const agingBuckets = {
    '0-7': customers.filter(c => c.ageCategory === '0-7'),
    '8-14': customers.filter(c => c.ageCategory === '8-14'),
    '15-30': customers.filter(c => c.ageCategory === '15-30'),
    '30+': customers.filter(c => c.ageCategory === '30+'),
  };

  const getBucketTotal = (bucket: typeof customers) => 
    bucket.reduce((sum, c) => sum + Number(c.credit_balance), 0);

  const getAgeBadgeVariant = (category: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (category) {
      case '0-7': return 'default';
      case '8-14': return 'secondary';
      case '15-30': return 'outline';
      case '30+': return 'destructive';
      default: return 'default';
    }
  };

  const exportToCSV = () => {
    const headers = ['Customer', 'Phone', 'Email', 'Balance', 'Credit Limit', 'Days Outstanding', 'Age Category'];
    const rows = customersWithDebt.map(c => [
      c.name,
      c.phone || '',
      c.email || '',
      Number(c.credit_balance),
      Number(c.credit_limit),
      c.daysSinceOldest,
      c.ageCategory,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-aging-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              KES {totalOutstanding.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From {customersWithDebt.length} customer{customersWithDebt.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        
        <Card className={cn(agingBuckets['0-7'].length > 0 && 'border-success/50')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">0-7 Days</CardTitle>
            <Clock className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {getBucketTotal(agingBuckets['0-7']).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {agingBuckets['0-7'].length} customer{agingBuckets['0-7'].length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        
        <Card className={cn(agingBuckets['8-14'].length > 0 && 'border-warning/50')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">8-14 Days</CardTitle>
            <Clock className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {getBucketTotal(agingBuckets['8-14']).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {agingBuckets['8-14'].length} customer{agingBuckets['8-14'].length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        
        <Card className={cn(agingBuckets['30+'].length > 0 && 'border-destructive/50')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">30+ Days (Overdue)</CardTitle>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              KES {getBucketTotal(agingBuckets['30+']).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {agingBuckets['30+'].length} customer{agingBuckets['30+'].length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Outstanding Balances by Customer
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {customersWithDebt.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No outstanding credit balances</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="text-right">% Used</TableHead>
                    <TableHead className="text-center">Days Outstanding</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersWithDebt
                    .sort((a, b) => Number(b.credit_balance) - Number(a.credit_balance))
                    .map((customer) => {
                      const balance = Number(customer.credit_balance);
                      const limit = Number(customer.credit_limit);
                      const usedPercent = limit > 0 ? (balance / limit) * 100 : 100;
                      
                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              {customer.phone && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </div>
                              )}
                              {customer.email && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="w-3 h-3" />
                                  {customer.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            KES {balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            KES {limit.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              'font-medium',
                              usedPercent >= 90 ? 'text-destructive' : 
                              usedPercent >= 70 ? 'text-warning' : 'text-foreground'
                            )}>
                              {usedPercent.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {customer.daysSinceOldest} days
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getAgeBadgeVariant(customer.ageCategory)}>
                              {customer.ageCategory === '30+' ? 'Overdue' : `${customer.ageCategory} days`}
                            </Badge>
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

export default CreditAgingReport;
