import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useParties } from '@/hooks/useParties';
import { useLegalCases } from '@/hooks/useLegalCases';
import {
  Search, ArrowDownLeft, ArrowUpRight, MessageSquare, Phone,
  Scale, AlertTriangle, TrendingDown, TrendingUp, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';

interface CreditCustomer {
  id: string;
  name: string;
  phone: string | null;
  credit_balance: number;
  credit_limit: number;
  credit_enabled: boolean;
  updated_at: string;
}

const DebtDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { parties, totalPayables } = useParties();
  const { cases, activeCases, totalClaimed } = useLegalCases();

  // Fetch customers with outstanding credit (receivables)
  const { data: creditCustomers = [] } = useQuery({
    queryKey: ['credit-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, credit_balance, credit_limit, credit_enabled, updated_at')
        .eq('credit_enabled', true)
        .gt('credit_balance', 0)
        .order('credit_balance', { ascending: false });
      if (error) throw error;
      return data as CreditCustomer[];
    },
  });

  const totalReceivables = creditCustomers.reduce((sum, c) => sum + (c.credit_balance || 0), 0);
  const payableParties = parties.filter(p => p.current_balance > 0);

  const getAgingColor = (updatedAt: string) => {
    const days = differenceInDays(new Date(), new Date(updatedAt));
    if (days <= 7) return 'text-success';
    if (days <= 14) return 'text-warning';
    if (days <= 30) return 'text-orange-500';
    return 'text-destructive';
  };

  const getAgingBadge = (updatedAt: string) => {
    const days = differenceInDays(new Date(), new Date(updatedAt));
    if (days <= 7) return <Badge className="bg-success/10 text-success border-success/30">0-7 days</Badge>;
    if (days <= 14) return <Badge className="bg-warning/10 text-warning border-warning/30">8-14 days</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/30">15-30 days</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/30">30+ days</Badge>;
  };

  const sendWhatsAppReminder = (phone: string, name: string, amount: number) => {
    const message = encodeURIComponent(
      `Hi ${name}, this is a friendly reminder that you have an outstanding balance of KES ${amount.toLocaleString()}. Please arrange payment at your earliest convenience. Thank you!`
    );
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? `254${cleanPhone.slice(1)}` : cleanPhone;
    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank');
  };

  const sendSMSReminder = (phone: string, name: string, amount: number) => {
    const message = `Hi ${name}, reminder: outstanding balance KES ${amount.toLocaleString()}. Please pay soon. Thank you!`;
    window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
  };

  const getCaseStatusColor = (status: string) => {
    switch (status) {
      case 'filed': return 'bg-info/10 text-info';
      case 'hearing_scheduled': return 'bg-warning/10 text-warning';
      case 'judgement': return 'bg-primary/10 text-primary';
      case 'settled': return 'bg-success/10 text-success';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Debt Dashboard</h1>
          <p className="text-muted-foreground">Track receivables, payables & legal cases</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-success">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-success" />
                Customers Owe You
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">KES {totalReceivables.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{creditCustomers.length} customers</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-destructive" />
                You Owe (Payables)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">KES {totalPayables.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{payableParties.length} parties</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Net Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', totalReceivables - totalPayables >= 0 ? 'text-success' : 'text-destructive')}>
                KES {Math.abs(totalReceivables - totalPayables).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">{totalReceivables - totalPayables >= 0 ? 'Net positive' : 'Net negative'}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Scale className="w-4 h-4 text-warning" />
                In Court (SCC)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">KES {totalClaimed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{activeCases.length} active cases</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search debtors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="receivables">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="receivables" className="gap-2">
              <ArrowDownLeft className="w-3.5 h-3.5 text-success" />
              Receivables ({creditCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="payables" className="gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
              Payables ({payableParties.length})
            </TabsTrigger>
            <TabsTrigger value="legal" className="gap-2">
              <Scale className="w-3.5 h-3.5" />
              Legal ({activeCases.length})
            </TabsTrigger>
          </TabsList>

          {/* Receivables Tab */}
          <TabsContent value="receivables">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Aging</TableHead>
                      <TableHead className="text-right">Owed</TableHead>
                      <TableHead className="text-right">Limit</TableHead>
                      <TableHead>Remind</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditCustomers
                      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm))
                      .map(customer => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.phone || '-'}</TableCell>
                          <TableCell>{getAgingBadge(customer.updated_at)}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-success">KES {customer.credit_balance.toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            KES {customer.credit_limit.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {customer.phone && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-success border-success/30"
                                    onClick={() => sendWhatsAppReminder(customer.phone!, customer.name, customer.credit_balance)}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => sendSMSReminder(customer.phone!, customer.name, customer.credit_balance)}
                                  >
                                    <Phone className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {creditCustomers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No outstanding receivables
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payables Tab */}
          <TabsContent value="payables">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Party</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">You Owe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payableParties
                      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(party => (
                        <TableRow key={party.id}>
                          <TableCell className="font-medium">{party.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{party.party_type}</Badge>
                          </TableCell>
                          <TableCell>{party.phone || '-'}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-destructive">KES {party.current_balance.toLocaleString()}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    {payableParties.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No outstanding payables
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legal Cases Tab */}
          <TabsContent value="legal">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case #</TableHead>
                      <TableHead>Debtor</TableHead>
                      <TableHead>Court</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Next Hearing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map(legalCase => (
                      <TableRow key={legalCase.id}>
                        <TableCell className="font-mono text-sm">{legalCase.case_number || '-'}</TableCell>
                        <TableCell className="font-medium">
                          {legalCase.customers?.name || legalCase.parties?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{legalCase.court_name}</TableCell>
                        <TableCell>
                          <Badge className={cn('capitalize', getCaseStatusColor(legalCase.status))}>
                            {legalCase.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          KES {legalCase.amount_claimed.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {legalCase.next_hearing_date ? format(new Date(legalCase.next_hearing_date), 'MMM d, yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {cases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No legal cases
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DebtDashboard;
