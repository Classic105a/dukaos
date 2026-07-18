import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowRight, Package, Truck, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface StockTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const StockTransferDialog = ({ isOpen, onClose }: StockTransferDialogProps) => {
  const { user } = useAuth();
  const { branches, currentBranch } = useBranch();
  const queryClient = useQueryClient();

  const [toBranchId, setToBranchId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch products for current branch
  const { data: products = [] } = useQuery({
    queryKey: ['transfer-products', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name, sku')
        .or(`branch_id.eq.${currentBranch.id},is_shared_product.eq.true`)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: isOpen && !!currentBranch?.id,
  });

  // Fetch existing transfers
  const { data: transfers = [] } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_transfers')
        .select('*, products(name), from_branch:from_branch_id(name), to_branch:to_branch_id(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  const createTransfer = useMutation({
    mutationFn: async () => {
      if (!currentBranch?.id || !user?.id) throw new Error('Not authenticated');
      if (!toBranchId || !selectedProductId || !quantity) throw new Error('Fill all fields');

      const qty = parseInt(quantity);
      if (qty <= 0) throw new Error('Quantity must be positive');

      const { error } = await supabase.from('stock_transfers').insert({
        from_branch_id: currentBranch.id,
        to_branch_id: toBranchId,
        business_id: currentBranch.business_id,
        product_id: selectedProductId,
        quantity: qty,
        initiated_by: user.id,
        notes: notes || null,
        status: 'pending',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast.success('Transfer created');
      setToBranchId('');
      setSelectedProductId('');
      setQuantity('');
      setNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const transfer = transfers.find(t => t.id === transferId);
      if (!transfer) throw new Error('Transfer not found');

      // Record stock movements
      await supabase.from('stock_movements').insert([
        {
          product_id: transfer.product_id,
          branch_id: transfer.from_branch_id!,
          business_id: currentBranch!.business_id,
          quantity_change: -transfer.quantity,
          movement_type: 'TRANSFER_OUT',
          reference_id: transferId,
          created_by: user.id,
          notes: `Transfer to ${(transfer as any).to_branch?.name}`,
        },
        {
          product_id: transfer.product_id,
          branch_id: transfer.to_branch_id,
          business_id: currentBranch!.business_id,
          quantity_change: transfer.quantity,
          movement_type: 'TRANSFER_IN',
          reference_id: transferId,
          created_by: user.id,
          notes: `Transfer from ${(transfer as any).from_branch?.name}`,
        },
      ] as any);

      // Update transfer status
      const { error } = await supabase
        .from('stock_transfers')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', transferId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Transfer completed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const otherBranches = branches.filter(b => b.id !== currentBranch?.id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-warning text-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge className="bg-success/10 text-success"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Stock Transfers
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="new">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Transfer</TabsTrigger>
            <TabsTrigger value="history">History ({transfers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Branch</Label>
                <Input value={currentBranch?.name || ''} disabled className="bg-muted" />
              </div>
              <div>
                <Label>To Branch *</Label>
                <Select value={toBranchId} onValueChange={setToBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherBranches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Transfer reason..."
                rows={2}
              />
            </div>

            <Button
              onClick={() => createTransfer.mutate()}
              disabled={!toBranchId || !selectedProductId || !quantity || createTransfer.isPending}
              className="w-full"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {createTransfer.isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {transfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No transfers yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {transfers.map(t => (
                  <Card key={t.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{(t as any).products?.name}</span>
                          <span className="text-muted-foreground">×{t.quantity}</span>
                        </div>
                        {getStatusBadge(t.status || 'pending')}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{(t as any).from_branch?.name}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{(t as any).to_branch?.name}</span>
                        <span className="ml-auto">{format(new Date(t.created_at), 'MMM d, HH:mm')}</span>
                      </div>
                      {t.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => completeTransfer.mutate(t.id)}
                          disabled={completeTransfer.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Complete Transfer
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default StockTransferDialog;
