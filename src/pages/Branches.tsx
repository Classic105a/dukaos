import { useState } from 'react';
import { useUsage } from '@/hooks/useUsage';
import UpgradeDialog from '@/components/subscription/UpgradeDialog';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { useBusiness } from '@/hooks/useBusiness';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Building2,
  MapPin,
  Phone,
  Package,
  ArrowRight,
  Users,
  TrendingUp,
  AlertTriangle,
  Edit,
  Trash2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Branch {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  is_headquarters: boolean | null;
  is_active: boolean | null;
}

interface StockTransfer {
  id: string;
  product_id: string;
  from_branch_id: string | null;
  to_branch_id: string;
  quantity: number;
  status: string | null;
  notes: string | null;
  created_at: string;
  products: { name: string };
  from_branch?: { name: string } | null;
  to_branch: { name: string };
}

interface BranchStock {
  product_id: string;
  branch_id: string;
  quantity: number;
  product_name: string;
  unit_price: number;
  low_stock_threshold: number | null;
}

const Branches = () => {
  const { branches, currentBranch, refetch } = useBranch();
  const { currentBusiness } = useBusiness();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch stock transfers
  const { data: transfers = [] } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          products(name),
          from_branch:branches!stock_transfers_from_branch_id_fkey(name),
          to_branch:branches!stock_transfers_to_branch_id_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StockTransfer[];
    },
  });

  // Fetch all stock from current_stock view, joined with products for display
  const { data: allStock = [] } = useQuery({
    queryKey: ['all-branch-stock'],
    queryFn: async () => {
      const { data: stockData, error: stockError } = await supabase
        .from('current_stock')
        .select('product_id, branch_id, quantity');
      if (stockError) throw stockError;

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, unit_price, low_stock_threshold')
        .eq('is_active', true);
      if (productsError) throw productsError;

      const productMap = new Map(
        (productsData || []).map((p) => [p.id, p])
      );

      return (stockData || [])
        .filter((s) => s.product_id && productMap.has(s.product_id))
        .map((s) => {
          const product = productMap.get(s.product_id!)!;
          return {
            product_id: s.product_id!,
            branch_id: s.branch_id!,
            quantity: s.quantity ?? 0,
            product_name: product.name,
            unit_price: product.unit_price,
            low_stock_threshold: product.low_stock_threshold,
          } as BranchStock;
        });
    },
  });

  // Fetch products for transfer
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Create branch mutation
  const createBranch = useMutation({
    mutationFn: async (branchData: Partial<Branch>) => {
      const businessId = currentBusiness?.id ?? (currentBranch as any)?.business_id;
      if (!businessId) throw new Error('No active business selected');
      const { data, error } = await supabase
        .from('branches')
        .insert([{ ...branchData, business_id: businessId } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Branch created successfully' });
      setBranchDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating branch', description: error.message, variant: 'destructive' });
    },
  });

  // Update branch mutation
  const updateBranch = useMutation({
    mutationFn: async ({ id, ...branchData }: Partial<Branch> & { id: string }) => {
      const { data, error } = await supabase
        .from('branches')
        .update(branchData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch updated successfully' });
      setEditDialogOpen(false);
      setEditingBranch(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating branch', description: error.message, variant: 'destructive' });
    },
  });

  // Delete branch mutation
  const deleteBranch = useMutation({
    mutationFn: async (branchId: string) => {
      // Check if branch has inventory or stock movements
      const { count: stockCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId);

      if (stockCount && stockCount > 0) {
        throw new Error('Cannot delete branch with existing stock movements. Transfer or clear stock first.');
      }

      // Check for products
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId);

      if (productCount && productCount > 0) {
        throw new Error('Cannot delete branch with products. Delete products first.');
      }

      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Branch deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting branch', description: error.message, variant: 'destructive' });
    },
  });

  // Create stock transfer mutation
  const createTransfer = useMutation({
    mutationFn: async (transferData: {
      product_id: string;
      from_branch_id: string | null;
      to_branch_id: string;
      quantity: number;
      notes?: string;
    }) => {
      const dest = branches.find((b: any) => b.id === transferData.to_branch_id);
      const businessId = (dest as any)?.business_id;
      if (!businessId) throw new Error('Destination branch missing business');
      const { data, error } = await supabase
        .from('stock_transfers')
        .insert({
          ...transferData,
          business_id: businessId,
          status: 'pending',
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast({ title: 'Transfer request created successfully' });
      setTransferDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating transfer', description: error.message, variant: 'destructive' });
    },
  });

  // Complete transfer mutation - uses stock_movements now
  const completeTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      const transfer = transfers.find(t => t.id === transferId);
      if (!transfer) throw new Error('Transfer not found');

      // Get current user for created_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Record TRANSFER_OUT from source branch
      if (transfer.from_branch_id) {
        const { error: outError } = await supabase.from('stock_movements').insert({
          product_id: transfer.product_id,
          branch_id: transfer.from_branch_id,
          business_id: (transfer as any).business_id,
          quantity_change: -transfer.quantity,
          movement_type: 'TRANSFER_OUT',
          reference_id: transferId,
          created_by: user.id,
          notes: `Transfer to ${transfer.to_branch?.name || transfer.to_branch_id}`,
        } as any);
        if (outError) throw outError;
      }

      // Record TRANSFER_IN to destination branch
      const { error: inError } = await supabase.from('stock_movements').insert({
        product_id: transfer.product_id,
        branch_id: transfer.to_branch_id,
        business_id: (transfer as any).business_id,
        quantity_change: transfer.quantity,
        movement_type: 'TRANSFER_IN',
        reference_id: transferId,
        created_by: user.id,
        notes: transfer.from_branch_id
          ? `Transfer from ${transfer.from_branch?.name || transfer.from_branch_id}`
          : 'New stock transfer',
      } as any);
      if (inError) throw inError;

      // Mark transfer as completed
      const { error } = await supabase
        .from('stock_transfers')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', transferId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['all-branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['current-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast({ title: 'Transfer completed successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error completing transfer', description: error.message, variant: 'destructive' });
    },
  });

  // Calculate branch stats using allStock
  const getBranchStats = (branchId: string) => {
    const branchStock = allStock.filter((s) => s.branch_id === branchId);
    const totalItems = branchStock.reduce((sum, s) => sum + s.quantity, 0);
    const totalValue = branchStock.reduce((sum, s) => sum + s.quantity * s.unit_price, 0);
    const lowStockCount = branchStock.filter(
      (s) => s.quantity <= (s.low_stock_threshold || 10)
    ).length;
    return { totalItems, totalValue, lowStockCount, productCount: branchStock.length };
  };

  const pendingTransfers = transfers.filter(t => t.status === 'pending');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Branch Management</h1>
            <p className="text-muted-foreground">
              Manage branches, inventory levels, and stock transfers
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Transfer Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Stock Transfer</DialogTitle>
                </DialogHeader>
                <TransferForm 
                  branches={branches}
                  products={products}
                  onSubmit={(data) => createTransfer.mutate(data)}
                />
              </DialogContent>
            </Dialog>
            <UpgradeDialog open={limitOpen} onOpenChange={setLimitOpen} limitKey="branches" />
            <Dialog open={branchDialogOpen} onOpenChange={(o) => {
              if (o && usageFor('branches').exceeded) { setLimitOpen(true); return; }
              setBranchDialogOpen(o);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Branch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Branch</DialogTitle>
                </DialogHeader>
                <BranchForm onSubmit={(data) => createBranch.mutate(data)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches.length}</div>
              <p className="text-xs text-muted-foreground">Active locations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KES {allStock.reduce((sum, s) => sum + s.quantity * s.unit_price, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Across all branches</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingTransfers.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting completion</p>
            </CardContent>
          </Card>
          <Card className={cn(pendingTransfers.length > 0 && 'border-warning')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertTriangle className={cn('w-4 h-4', pendingTransfers.length > 0 ? 'text-warning' : 'text-muted-foreground')} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allStock.filter((s) => s.quantity <= (s.low_stock_threshold || 10)).length}
              </div>
              <p className="text-xs text-muted-foreground">Across all branches</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs
          value={searchParams.get('tab') || 'branches'}
          onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="transfers" className="gap-2">
              Transfers
              {pendingTransfers.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingTransfers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inventory">Centralized Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map(branch => {
                const stats = getBranchStats(branch.id);
                const isCurrentBranch = currentBranch?.id === branch.id;
                
                return (
                  <Card 
                    key={branch.id} 
                    className={cn(
                      'hover:shadow-soft transition-shadow',
                      isCurrentBranch && 'ring-2 ring-primary'
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {branch.name}
                              {branch.is_headquarters && (
                                <Badge variant="secondary" className="text-xs">HQ</Badge>
                              )}
                            </CardTitle>
                            {branch.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {branch.location}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCurrentBranch && (
                            <Badge variant="outline" className="text-xs mr-2">Current</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingBranch(branch);
                              setEditDialogOpen(true);
                            }}
                            title="Edit branch"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!isCurrentBranch && !branch.is_headquarters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Delete branch "${branch.name}"? This cannot be undone.`)) {
                                  deleteBranch.mutate(branch.id);
                                }
                              }}
                              title="Delete branch"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Products</p>
                          <p className="font-medium">{stats.productCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Items</p>
                          <p className="font-medium">{stats.totalItems.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Stock Value</p>
                          <p className="font-medium">KES {stats.totalValue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Low Stock</p>
                          <p className={cn('font-medium', stats.lowStockCount > 0 && 'text-warning')}>
                            {stats.lowStockCount} items
                          </p>
                        </div>
                      </div>
                      {branch.phone && (
                        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {branch.phone}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="transfers" className="space-y-4">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground">Product</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">From</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">To</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Quantity</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map(transfer => (
                      <tr key={transfer.id} className="border-b border-border hover:bg-muted/50">
                        <td className="p-4 font-medium">{transfer.products.name}</td>
                        <td className="p-4 text-muted-foreground">
                          {transfer.from_branch?.name || 'Supplier'}
                        </td>
                        <td className="p-4">{transfer.to_branch.name}</td>
                        <td className="p-4 text-right font-medium">{transfer.quantity}</td>
                        <td className="p-4">
                          <Badge variant={
                            transfer.status === 'completed' ? 'default' :
                            transfer.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {transfer.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {format(new Date(transfer.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 text-right">
                          {transfer.status === 'pending' && (
                            <Button 
                              size="sm"
                              onClick={() => completeTransfer.mutate(transfer.id)}
                            >
                              Complete
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {transfers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No transfers yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground">Product</th>
                      {branches.map(branch => (
                        <th key={branch.id} className="text-right p-4 font-medium text-muted-foreground">
                          {branch.name}
                        </th>
                      ))}
                      <th className="text-right p-4 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const productStock = allStock.filter((s) => s.product_id === product.id);
                      const total = productStock.reduce((sum, s) => sum + s.quantity, 0);

                      return (
                        <tr key={product.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-4 font-medium">{product.name}</td>
                          {branches.map((branch) => {
                            const stock = productStock.find((s) => s.branch_id === branch.id);
                            return (
                              <td key={branch.id} className="p-4 text-right">
                                {stock ? stock.quantity : 0}
                              </td>
                            );
                          })}
                          <td className="p-4 text-right font-bold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Branch Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingBranch(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Branch</DialogTitle>
            </DialogHeader>
            {editingBranch && (
              <EditBranchForm 
                branch={editingBranch}
                onSubmit={(data) => updateBranch.mutate({ id: editingBranch.id, ...data })}
                isLoading={updateBranch.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Branch Form Component
const BranchForm = ({ onSubmit }: { onSubmit: (data: Partial<Branch>) => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: '',
    is_headquarters: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      location: formData.location || null,
      phone: formData.phone || null,
      is_headquarters: formData.is_headquarters,
      is_active: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Branch Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="e.g., Westlands, Nairobi"
        />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+254..."
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="headquarters"
          checked={formData.is_headquarters}
          onCheckedChange={(checked) => setFormData({ ...formData, is_headquarters: checked })}
        />
        <Label htmlFor="headquarters">This is the headquarters</Label>
      </div>
      <Button type="submit" className="w-full">Create Branch</Button>
    </form>
  );
};

// Edit Branch Form Component
const EditBranchForm = ({ 
  branch,
  onSubmit,
  isLoading 
}: { 
  branch: Branch;
  onSubmit: (data: Partial<Branch>) => void;
  isLoading?: boolean;
}) => {
  const [formData, setFormData] = useState({
    name: branch.name,
    location: branch.location || '',
    phone: branch.phone || '',
    is_headquarters: branch.is_headquarters,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      location: formData.location || null,
      phone: formData.phone || null,
      is_headquarters: formData.is_headquarters,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-name">Branch Name *</Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="edit-location">Location</Label>
        <Input
          id="edit-location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="e.g., Westlands, Nairobi"
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="edit-phone">Phone</Label>
        <Input
          id="edit-phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+254..."
          disabled={isLoading}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="edit-headquarters"
          checked={formData.is_headquarters ?? false}
          onCheckedChange={(checked) => setFormData({ ...formData, is_headquarters: checked })}
          disabled={isLoading}
        />
        <Label htmlFor="edit-headquarters">This is the headquarters</Label>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
};

// Transfer Form Component
const TransferForm = ({ 
  branches, 
  products,
  onSubmit 
}: { 
  branches: Branch[];
  products: { id: string; name: string }[];
  onSubmit: (data: {
    product_id: string;
    from_branch_id: string | null;
    to_branch_id: string;
    quantity: number;
    notes?: string;
  }) => void;
}) => {
  const [formData, setFormData] = useState({
    product_id: '',
    from_branch_id: '',
    to_branch_id: '',
    quantity: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      product_id: formData.product_id,
      from_branch_id: formData.from_branch_id || null,
      to_branch_id: formData.to_branch_id,
      quantity: parseInt(formData.quantity),
      notes: formData.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="product">Product *</Label>
        <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map(product => (
              <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="from_branch">From Branch</Label>
        <Select value={formData.from_branch_id} onValueChange={(v) => setFormData({ ...formData, from_branch_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select source (or leave empty for new stock)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">New Stock (Supplier)</SelectItem>
            {branches.map(branch => (
              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="to_branch">To Branch *</Label>
        <Select value={formData.to_branch_id} onValueChange={(v) => setFormData({ ...formData, to_branch_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select destination" />
          </SelectTrigger>
          <SelectContent>
            {branches.map(branch => (
              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="quantity">Quantity *</Label>
        <Input
          id="quantity"
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full">Create Transfer</Button>
    </form>
  );
};

export default Branches;
