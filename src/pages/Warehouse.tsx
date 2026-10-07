import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Truck, PackageCheck, ClipboardList, FileText,
  ArrowRight, Search, Calendar, Package
} from 'lucide-react';

const Warehouse = () => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('purchase-orders');
  const [showPODialog, setShowPODialog] = useState(false);
  const [showGRNDialog, setShowGRNDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // PO form state
  const [poForm, setPOForm] = useState({
    supplier_id: '',
    expected_delivery_date: '',
    notes: '',
    items: [] as Array<{ product_id: string; product_name: string; quantity_ordered: number; unit_cost: number }>,
  });

  // GRN form state
  const [grnForm, setGRNForm] = useState({
    purchase_order_id: '',
    supplier_id: '',
    notes: '',
    items: [] as Array<{ product_id: string; product_name: string; quantity_expected: number; quantity_received: number; quantity_damaged: number; unit_cost: number; batch_number: string; expiry_date: string }>,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await supabase.from('parties').select('*').eq('party_type', 'supplier').eq('is_active', true);
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, cost_price, unit_price').eq('is_active', true);
      return data || [];
    },
  });

  const { data: purchaseOrders, isLoading: loadingPOs } = useQuery({
    queryKey: ['purchase-orders', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, parties(name)')
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentBranch?.id,
  });

  const { data: grns, isLoading: loadingGRNs } = useQuery({
    queryKey: ['grns', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const { data } = await supabase
        .from('goods_received_notes')
        .select('*, parties(name), purchase_orders(order_number)')
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentBranch?.id,
  });

  const createPOMutation = useMutation({
    mutationFn: async () => {
      if (!currentBranch?.id || !user?.id) throw new Error('Missing context');
      const orderNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
      const subtotal = poForm.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          branch_id: currentBranch.id,
          business_id: (currentBranch as any).business_id,
          supplier_id: poForm.supplier_id || null,
          order_number: orderNumber,
          expected_delivery_date: poForm.expected_delivery_date || null,
          subtotal,
          total_amount: subtotal,
          notes: poForm.notes || null,
          created_by: user.id,
          status: 'pending',
        } as any)
        .select()
        .single();

      if (poError) throw poError;

      if (poForm.items.length > 0) {
        const { error } = await supabase.from('purchase_order_items').insert(
          poForm.items.map(item => ({
            purchase_order_id: po.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity_ordered: item.quantity_ordered,
            unit_cost: item.unit_cost,
            total_cost: item.quantity_ordered * item.unit_cost,
          }))
        );
        if (error) throw error;
      }
      return po;
    },
    onSuccess: () => {
      toast.success('Purchase order created');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setShowPODialog(false);
      setPOForm({ supplier_id: '', expected_delivery_date: '', notes: '', items: [] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create PO'),
  });

  const createGRNMutation = useMutation({
    mutationFn: async () => {
      if (!currentBranch?.id || !user?.id) throw new Error('Missing context');
      const grnNumber = `GRN-${Date.now().toString(36).toUpperCase()}`;
      const totalItems = grnForm.items.reduce((s, i) => s + i.quantity_received, 0);
      const totalValue = grnForm.items.reduce((s, i) => s + i.quantity_received * i.unit_cost, 0);

      const { data: grn, error: grnError } = await supabase
        .from('goods_received_notes')
        .insert({
          grn_number: grnNumber,
          branch_id: currentBranch.id,
          business_id: (currentBranch as any).business_id,
          purchase_order_id: grnForm.purchase_order_id || null,
          supplier_id: grnForm.supplier_id || null,
          received_by: user.id,
          status: 'completed',
          total_items: totalItems,
          total_value: totalValue,
          notes: grnForm.notes || null,
        } as any)
        .select()
        .single();

      if (grnError) throw grnError;

      if (grnForm.items.length > 0) {
        const { error: itemsError } = await supabase.from('grn_items').insert(
          grnForm.items.map(item => ({
            grn_id: grn.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity_expected: item.quantity_expected,
            quantity_received: item.quantity_received,
            quantity_damaged: item.quantity_damaged,
            unit_cost: item.unit_cost,
            total_cost: item.quantity_received * item.unit_cost,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
          }))
        );
        if (itemsError) throw itemsError;

        // Stock ledger entries for received items (trigger updates current_stock)
        const receivedItems = grnForm.items.filter(i => i.quantity_received > 0);
        if (receivedItems.length > 0) {
          const { error: movementError } = await supabase.from('stock_movements').insert(
            receivedItems.map(item => ({
              product_id: item.product_id,
              branch_id: currentBranch.id,
              business_id: (currentBranch as any).business_id,
              quantity_change: item.quantity_received,
              movement_type: 'PURCHASE',
              reference_id: grn.id,
              created_by: user.id,
              batch_number: item.batch_number || null,
              expiry_date: item.expiry_date || null,
              notes: `GRN ${grnNumber}`,
            })) as any
          );
          if (movementError) throw new Error(`GRN saved but stock was not updated: ${movementError.message}`);
        }
      }
      return grn;
    },
    onSuccess: () => {
      toast.success('Goods received & stock updated');
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setShowGRNDialog(false);
      setGRNForm({ purchase_order_id: '', supplier_id: '', notes: '', items: [] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create GRN'),
  });

  const addPOItem = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;
    if (poForm.items.some(i => i.product_id === productId)) {
      toast.error('Product already added');
      return;
    }
    setPOForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        product_name: product.name,
        quantity_ordered: 1,
        unit_cost: product.cost_price || 0,
      }],
    }));
  };

  const addGRNItem = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;
    if (grnForm.items.some(i => i.product_id === productId)) {
      toast.error('Product already added');
      return;
    }
    setGRNForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        product_name: product.name,
        quantity_expected: 0,
        quantity_received: 1,
        quantity_damaged: 0,
        unit_cost: product.cost_price || 0,
        batch_number: '',
        expiry_date: '',
      }],
    }));
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      pending: 'bg-warning/10 text-warning',
      approved: 'bg-info/10 text-info',
      ordered: 'bg-primary/10 text-primary',
      received: 'bg-success/10 text-success',
      completed: 'bg-success/10 text-success',
      cancelled: 'bg-destructive/10 text-destructive',
    };
    return map[status] || 'bg-muted text-muted-foreground';
  };

  const poTotal = poForm.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
  const grnTotal = grnForm.items.reduce((s, i) => s + i.quantity_received * i.unit_cost, 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Warehouse</h1>
            <p className="text-sm text-muted-foreground">Purchase orders, goods receiving & stock intake</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><ClipboardList className="w-4 h-4 mr-1.5" />New PO</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Purchase Order</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Supplier</Label>
                      <Select value={poForm.supplier_id} onValueChange={v => setPOForm(p => ({ ...p, supplier_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expected Delivery</Label>
                      <Input type="date" value={poForm.expected_delivery_date} onChange={e => setPOForm(p => ({ ...p, expected_delivery_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Add Products</Label>
                    <Select onValueChange={addPOItem}>
                      <SelectTrigger><SelectValue placeholder="Search & add product..." /></SelectTrigger>
                      <SelectContent>
                        {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — KES {p.cost_price}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {poForm.items.length > 0 && (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-28">Unit Cost</TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                        <TableHead className="w-10" />
                      </TableRow></TableHeader>
                      <TableBody>
                        {poForm.items.map((item, idx) => (
                          <TableRow key={item.product_id}>
                            <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                            <TableCell>
                              <Input type="number" min={1} value={item.quantity_ordered} className="h-8"
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 1;
                                  setPOForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity_ordered: val } : it) }));
                                }} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} value={item.unit_cost} className="h-8"
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setPOForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, unit_cost: val } : it) }));
                                }} />
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              KES {(item.quantity_ordered * item.unit_cost).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon-sm" onClick={() => setPOForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>×</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">KES {poTotal.toLocaleString()}</span></span>
                    <Button onClick={() => createPOMutation.mutate()} disabled={poForm.items.length === 0 || createPOMutation.isPending}>
                      {createPOMutation.isPending ? 'Creating...' : 'Create PO'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showGRNDialog} onOpenChange={setShowGRNDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><PackageCheck className="w-4 h-4 mr-1.5" />Receive Goods</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Goods Receiving Note</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Supplier</Label>
                      <Select value={grnForm.supplier_id} onValueChange={v => setGRNForm(p => ({ ...p, supplier_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Against PO (optional)</Label>
                      <Select value={grnForm.purchase_order_id} onValueChange={v => setGRNForm(p => ({ ...p, purchase_order_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                        <SelectContent>
                          {purchaseOrders?.filter(po => po.status !== 'cancelled').map(po => (
                            <SelectItem key={po.id} value={po.id}>{po.order_number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Add Products</Label>
                    <Select onValueChange={addGRNItem}>
                      <SelectTrigger><SelectValue placeholder="Search & add product..." /></SelectTrigger>
                      <SelectContent>
                        {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {grnForm.items.length > 0 && (
                    <div className="space-y-3">
                      {grnForm.items.map((item, idx) => (
                        <Card key={item.product_id} variant="filled" className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">{item.product_name}</span>
                            <Button variant="ghost" size="icon-sm" onClick={() => setGRNForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>×</Button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <Label className="text-2xs">Qty Received</Label>
                              <Input type="number" min={0} value={item.quantity_received} className="h-8 mt-1"
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setGRNForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity_received: val } : it) }));
                                }} />
                            </div>
                            <div>
                              <Label className="text-2xs">Damaged</Label>
                              <Input type="number" min={0} value={item.quantity_damaged} className="h-8 mt-1"
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setGRNForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity_damaged: val } : it) }));
                                }} />
                            </div>
                            <div>
                              <Label className="text-2xs">Batch #</Label>
                              <Input value={item.batch_number} className="h-8 mt-1" placeholder="Optional"
                                onChange={e => setGRNForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, batch_number: e.target.value } : it) }))} />
                            </div>
                            <div>
                              <Label className="text-2xs">Expiry</Label>
                              <Input type="date" value={item.expiry_date} className="h-8 mt-1"
                                onChange={e => setGRNForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, expiry_date: e.target.value } : it) }))} />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                  <Textarea placeholder="Notes..." value={grnForm.notes} onChange={e => setGRNForm(p => ({ ...p, notes: e.target.value }))} />
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">KES {grnTotal.toLocaleString()}</span></span>
                    <Button onClick={() => createGRNMutation.mutate()} disabled={grnForm.items.length === 0 || createGRNMutation.isPending}>
                      {createGRNMutation.isPending ? 'Receiving...' : 'Confirm Receipt'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Open POs</p>
                <p className="text-xl font-bold">{purchaseOrders?.filter(po => po.status === 'pending').length || 0}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">Awaiting Delivery</p>
                <p className="text-xl font-bold">{purchaseOrders?.filter(po => po.status === 'ordered').length || 0}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <PackageCheck className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">GRNs This Month</p>
                <p className="text-xl font-bold">{grns?.length || 0}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground">PO Value</p>
                <p className="text-xl font-bold">KES {(purchaseOrders?.reduce((s, po) => s + Number(po.total_amount), 0) || 0).toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="grn">Goods Received</TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Delivery</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPOs ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                      ) : purchaseOrders?.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>
                      ) : purchaseOrders?.map(po => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-sm font-medium">{po.order_number}</TableCell>
                          <TableCell>{(po as any).parties?.name || '—'}</TableCell>
                          <TableCell className="text-sm">{format(new Date(po.order_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-sm">{po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'dd MMM') : '—'}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">KES {Number(po.total_amount).toLocaleString()}</TableCell>
                          <TableCell><Badge className={statusColor(po.status)}>{po.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grn" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GRN #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>PO Ref</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingGRNs ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                      ) : grns?.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No goods received yet</TableCell></TableRow>
                      ) : grns?.map(grn => (
                        <TableRow key={grn.id}>
                          <TableCell className="font-mono text-sm font-medium">{grn.grn_number}</TableCell>
                          <TableCell>{(grn as any).parties?.name || '—'}</TableCell>
                          <TableCell className="text-sm">{(grn as any).purchase_orders?.order_number || '—'}</TableCell>
                          <TableCell className="text-sm">{format(new Date(grn.received_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right">{grn.total_items}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">KES {Number(grn.total_value).toLocaleString()}</TableCell>
                          <TableCell><Badge className={statusColor(grn.status)}>{grn.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Warehouse;
