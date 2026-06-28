import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import CreditPaymentDialog from '@/components/customers/CreditPaymentDialog';
import CreditHistoryPanel from '@/components/customers/CreditHistoryPanel';
import InstallmentPlanDialog from '@/components/customers/InstallmentPlanDialog';
import InstallmentPlansPanel from '@/components/customers/InstallmentPlansPanel';
import {
  Plus,
  Search,
  Users,
  Crown,
  Star,
  Gift,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  TrendingUp,
  Edit,
  CreditCard,
  Wallet,
  AlertTriangle,
  Calendar,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  loyalty_points: number | null;
  total_purchases: number | null;
  visit_count: number | null;
  segment: string | null;
  notes: string | null;
  created_at: string;
  credit_enabled: boolean;
  credit_limit: number;
  credit_balance: number;
}

interface CustomerSale {
  id: string;
  receipt_number: string;
  total_amount: number;
  created_at: string;
  sale_items: { product_name: string; quantity: number; total_amount: number }[];
}

const Customers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions } = usePermissions();
  const { useCreditHistory, enableCredit, recordPayment } = useCustomerCredit();
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [creditPaymentDialogOpen, setCreditPaymentDialogOpen] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [installmentCustomer, setInstallmentCustomer] = useState<Customer | null>(null);

  // Fetch customers — capped at 1000 rows; UI search/segment filtering runs
  // client-side over this window. Larger tenants should switch to server-side
  // pagination via a dedicated RPC.
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('total_purchases', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Customer[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  // Fetch customer sales when details dialog is open
  const { data: customerSales = [] } = useQuery({
    queryKey: ['customer-sales', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(product_name, quantity, total_amount)')
        .eq('customer_id', selectedCustomer.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as CustomerSale[];
    },
    enabled: !!selectedCustomer?.id && detailsDialogOpen,
  });

  // Create customer mutation
  const createCustomer = useMutation({
    mutationFn: async (customerData: Partial<Customer>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer created successfully' });
      setCustomerDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating customer', description: error.message, variant: 'destructive' });
    },
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...customerData }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer updated successfully' });
      setCustomerDialogOpen(false);
      setSelectedCustomer(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating customer', description: error.message, variant: 'destructive' });
    },
  });

  // Add loyalty points mutation
  const addLoyaltyPoints = useMutation({
    mutationFn: async ({ customerId, points }: { customerId: string; points: number }) => {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) throw new Error('Customer not found');
      
      const { error } = await supabase
        .from('customers')
        .update({ loyalty_points: (customer.loyalty_points || 0) + points })
        .eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Points added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding points', description: error.message, variant: 'destructive' });
    },
  });

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = segmentFilter === 'all' || customer.segment === segmentFilter;
    return matchesSearch && matchesSegment;
  });

  // Segment customers
  const vipCustomers = customers.filter(c => c.segment === 'vip');
  const regularCustomers = customers.filter(c => c.segment === 'regular' || !c.segment);
  const newCustomers = customers.filter(c => c.segment === 'new');
  const creditCustomers = customers.filter(c => c.credit_enabled);

  // Total stats
  const totalCustomers = customers.length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0);
  const totalPurchases = customers.reduce((sum, c) => sum + (c.total_purchases || 0), 0);

  const getSegmentIcon = (segment: string | null) => {
    switch (segment) {
      case 'vip': return <Crown className="w-4 h-4 text-warning" />;
      case 'new': return <Star className="w-4 h-4 text-info" />;
      default: return <Users className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSegmentColor = (segment: string | null) => {
    switch (segment) {
      case 'vip': return 'bg-warning/10 text-warning border-warning/30';
      case 'new': return 'bg-info/10 text-info border-info/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customer Management</h1>
            <p className="text-muted-foreground">
              Manage customers, loyalty points, and purchase history
            </p>
          </div>
          <Dialog open={customerDialogOpen} onOpenChange={(open) => {
            setCustomerDialogOpen(open);
            if (!open) setSelectedCustomer(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <CustomerForm 
                customer={selectedCustomer}
                onSubmit={(data) => {
                  if (selectedCustomer) {
                    updateCustomer.mutate({ id: selectedCustomer.id, ...data });
                  } else {
                    createCustomer.mutate(data);
                  }
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Registered customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
              <Crown className="w-4 h-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vipCustomers.length}</div>
              <p className="text-xs text-muted-foreground">Premium members</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Gift className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLoyaltyPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Loyalty points issued</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {totalPurchases.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From all customers</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="new">New</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Customer List */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({customers.length})</TabsTrigger>
            <TabsTrigger value="vip" className="gap-2">
              <Crown className="w-3.5 h-3.5" />
              VIP ({vipCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="regular">Regular ({regularCustomers.length})</TabsTrigger>
            <TabsTrigger value="new">New ({newCustomers.length})</TabsTrigger>
            <TabsTrigger value="credit" className="gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              Credit ({creditCustomers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <CustomerTable 
              customers={filteredCustomers}
              isLoading={isLoading}
              onEdit={(customer) => {
                setSelectedCustomer(customer);
                setCustomerDialogOpen(true);
              }}
              onViewDetails={(customer) => {
                setSelectedCustomer(customer);
                setDetailsDialogOpen(true);
              }}
              onRecordPayment={(customer) => {
                setCreditCustomer(customer);
                setCreditPaymentDialogOpen(true);
              }}
              getSegmentIcon={getSegmentIcon}
              getSegmentColor={getSegmentColor}
            />
          </TabsContent>

          <TabsContent value="vip">
            <CustomerTable 
              customers={vipCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm)
              )}
              isLoading={isLoading}
              onEdit={(customer) => {
                setSelectedCustomer(customer);
                setCustomerDialogOpen(true);
              }}
              onViewDetails={(customer) => {
                setSelectedCustomer(customer);
                setDetailsDialogOpen(true);
              }}
              onRecordPayment={(customer) => {
                setCreditCustomer(customer);
                setCreditPaymentDialogOpen(true);
              }}
              getSegmentIcon={getSegmentIcon}
              getSegmentColor={getSegmentColor}
            />
          </TabsContent>

          <TabsContent value="regular">
            <CustomerTable 
              customers={regularCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm)
              )}
              isLoading={isLoading}
              onEdit={(customer) => {
                setSelectedCustomer(customer);
                setCustomerDialogOpen(true);
              }}
              onViewDetails={(customer) => {
                setSelectedCustomer(customer);
                setDetailsDialogOpen(true);
              }}
              onRecordPayment={(customer) => {
                setCreditCustomer(customer);
                setCreditPaymentDialogOpen(true);
              }}
              getSegmentIcon={getSegmentIcon}
              getSegmentColor={getSegmentColor}
            />
          </TabsContent>

          <TabsContent value="new">
            <CustomerTable 
              customers={newCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm)
              )}
              isLoading={isLoading}
              onEdit={(customer) => {
                setSelectedCustomer(customer);
                setCustomerDialogOpen(true);
              }}
              onViewDetails={(customer) => {
                setSelectedCustomer(customer);
                setDetailsDialogOpen(true);
              }}
              onRecordPayment={(customer) => {
                setCreditCustomer(customer);
                setCreditPaymentDialogOpen(true);
              }}
              getSegmentIcon={getSegmentIcon}
              getSegmentColor={getSegmentColor}
            />
          </TabsContent>

          <TabsContent value="credit">
            <CustomerTable 
              customers={creditCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm)
              )}
              isLoading={isLoading}
              onEdit={(customer) => {
                setSelectedCustomer(customer);
                setCustomerDialogOpen(true);
              }}
              onViewDetails={(customer) => {
                setSelectedCustomer(customer);
                setDetailsDialogOpen(true);
              }}
              onRecordPayment={(customer) => {
                setCreditCustomer(customer);
                setCreditPaymentDialogOpen(true);
              }}
              getSegmentIcon={getSegmentIcon}
              getSegmentColor={getSegmentColor}
            />
          </TabsContent>
        </Tabs>

        {/* Customer Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedCustomer?.name}
                {selectedCustomer && (
                  <Badge variant="outline" className={cn(getSegmentColor(selectedCustomer.segment))}>
                    {getSegmentIcon(selectedCustomer.segment)}
                    <span className="ml-1 capitalize">{selectedCustomer.segment || 'Regular'}</span>
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {selectedCustomer.phone || 'No phone'}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {selectedCustomer.email || 'No email'}
                  </div>
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedCustomer.address || 'No address'}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Gift className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{selectedCustomer.loyalty_points || 0}</p>
                      <p className="text-xs text-muted-foreground">Loyalty Points</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <ShoppingBag className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{selectedCustomer.visit_count || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Visits</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">KES {(selectedCustomer.total_purchases || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Purchase History */}
                <div>
                  <h4 className="font-medium mb-3">Recent Purchases</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {customerSales.map(sale => (
                      <div key={sale.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{sale.receipt_number}</span>
                          <span className="text-muted-foreground">
                            {format(new Date(sale.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {sale.sale_items.map(item => item.product_name).join(', ')}
                        </div>
                        <div className="text-right font-medium mt-1">
                          KES {Number(sale.total_amount).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {customerSales.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        No purchase history yet
                      </p>
                    )}
                  </div>
                </div>

                {/* Credit Section */}
                {selectedCustomer.credit_enabled ? (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        Credit Account
                      </h4>
                      <Badge variant={selectedCustomer.credit_balance > 0 ? 'destructive' : 'secondary'}>
                        {selectedCustomer.credit_balance > 0 ? 'Outstanding' : 'Clear'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Credit Limit</p>
                        <p className="text-lg font-bold">KES {selectedCustomer.credit_limit.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                        <p className={cn("text-lg font-bold", selectedCustomer.credit_balance > 0 && "text-destructive")}>
                          KES {selectedCustomer.credit_balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available Credit</p>
                      <p className="text-lg font-bold text-success">
                        KES {Math.max(0, selectedCustomer.credit_limit - selectedCustomer.credit_balance).toLocaleString()}
                      </p>
                    </div>
                    {selectedCustomer.credit_balance > 0 && (
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1"
                          onClick={() => {
                            setCreditCustomer(selectedCustomer);
                            setCreditPaymentDialogOpen(true);
                            setDetailsDialogOpen(false);
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Record Payment
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setInstallmentCustomer(selectedCustomer);
                            setInstallmentDialogOpen(true);
                            setDetailsDialogOpen(false);
                          }}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Create Plan
                        </Button>
                      </div>
                    )}
                    
                    {/* Installment Plans */}
                    <div className="mt-4">
                      <h5 className="text-sm font-medium mb-2">Payment Plans</h5>
                      <InstallmentPlansPanel 
                        customerId={selectedCustomer.id}
                        onRecordPayment={() => {
                          setCreditCustomer(selectedCustomer);
                          setCreditPaymentDialogOpen(true);
                          setDetailsDialogOpen(false);
                        }}
                      />
                    </div>
                    
                    {/* Credit History */}
                    <div className="mt-4">
                      <h5 className="text-sm font-medium mb-2">Transaction History</h5>
                      <CreditHistoryPanel customerId={selectedCustomer.id} />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/30 rounded-lg border border-dashed text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">Credit not enabled for this customer</p>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailsDialogOpen(false);
                        setSelectedCustomer(selectedCustomer);
                        setCustomerDialogOpen(true);
                      }}
                    >
                      Enable Credit
                    </Button>
                  </div>
                )}

                {/* Notes */}
                {selectedCustomer.notes && (
                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedCustomer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Credit Payment Dialog */}
        <CreditPaymentDialog
          isOpen={creditPaymentDialogOpen}
          onClose={() => {
            setCreditPaymentDialogOpen(false);
            setCreditCustomer(null);
          }}
          customer={creditCustomer}
        />

        {/* Installment Plan Dialog */}
        <InstallmentPlanDialog
          isOpen={installmentDialogOpen}
          onClose={() => {
            setInstallmentDialogOpen(false);
            setInstallmentCustomer(null);
          }}
          customer={installmentCustomer}
        />
      </div>
    </DashboardLayout>
  );
};

// Customer Table Component
const CustomerTable = ({ 
  customers, 
  isLoading,
  onEdit,
  onViewDetails,
  onRecordPayment,
  getSegmentIcon,
  getSegmentColor,
}: { 
  customers: Customer[];
  isLoading: boolean;
  onEdit: (customer: Customer) => void;
  onViewDetails: (customer: Customer) => void;
  onRecordPayment: (customer: Customer) => void;
  getSegmentIcon: (segment: string | null) => React.ReactNode;
  getSegmentColor: (segment: string | null) => string;
}) => {
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Users className="w-12 h-12 mb-2 opacity-50" />
          <p>No customers found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground">Customer</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Contact</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Segment</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Credit</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Points</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Total Spent</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => (
              <tr 
                key={customer.id} 
                className="border-b border-border hover:bg-muted/50 cursor-pointer"
                onClick={() => onViewDetails(customer)}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Since {format(new Date(customer.created_at), 'MMM yyyy')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm">
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
                </td>
                <td className="p-4">
                  <Badge variant="outline" className={cn(getSegmentColor(customer.segment))}>
                    {getSegmentIcon(customer.segment)}
                    <span className="ml-1 capitalize">{customer.segment || 'Regular'}</span>
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  {customer.credit_enabled ? (
                    <div className="text-right">
                      <p className={cn(
                        "font-medium tabular-nums",
                        customer.credit_balance > 0 && "text-destructive"
                      )}>
                        KES {customer.credit_balance.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        / {customer.credit_limit.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
                <td className="p-4 text-right font-medium">
                  <span className="flex items-center justify-end gap-1">
                    <Gift className="w-3.5 h-3.5 text-primary" />
                    {customer.loyalty_points || 0}
                  </span>
                </td>
                <td className="p-4 text-right font-medium">
                  KES {(customer.total_purchases || 0).toLocaleString()}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {customer.credit_enabled && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customers/${customer.id}/statement`);
                        }}
                        title="View Statement"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    {customer.credit_enabled && customer.credit_balance > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecordPayment(customer);
                        }}
                        title="Record Payment"
                      >
                        <Wallet className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(customer);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// Customer Form Component
const CustomerForm = ({ 
  customer,
  onSubmit 
}: { 
  customer?: Customer | null;
  onSubmit: (data: Partial<Customer>) => void;
}) => {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    segment: customer?.segment || 'regular',
    notes: customer?.notes || '',
    credit_enabled: customer?.credit_enabled || false,
    credit_limit: customer?.credit_limit || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      segment: formData.segment,
      notes: formData.notes || null,
      credit_enabled: formData.credit_enabled,
      credit_limit: formData.credit_enabled ? formData.credit_limit : 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+254..."
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="segment">Segment</Label>
        <Select value={formData.segment} onValueChange={(v) => setFormData({ ...formData, segment: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Credit Settings Section */}
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="credit_enabled" className="font-medium">Enable Credit Account</Label>
            <p className="text-xs text-muted-foreground">Allow customer to purchase on credit</p>
          </div>
          <Switch
            id="credit_enabled"
            checked={formData.credit_enabled}
            onCheckedChange={(checked) => setFormData({ ...formData, credit_enabled: checked })}
          />
        </div>
        
        {formData.credit_enabled && (
          <div>
            <Label htmlFor="credit_limit">Credit Limit (KES)</Label>
            <Input
              id="credit_limit"
              type="number"
              min="0"
              step="100"
              value={formData.credit_limit}
              onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
              placeholder="e.g., 10000"
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
        />
      </div>
      <Button type="submit" className="w-full">
        {customer ? 'Update Customer' : 'Add Customer'}
      </Button>
    </form>
  );
};

export default Customers;
