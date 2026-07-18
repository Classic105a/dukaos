import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Percent, Tag, Zap, Gift, Calendar, TrendingUp, ToggleLeft
} from 'lucide-react';

const promotionTypes = [
  { value: 'percentage_discount', label: 'Percentage Off', icon: Percent },
  { value: 'fixed_discount', label: 'Fixed Amount Off', icon: Tag },
  { value: 'buy_x_get_y', label: 'Buy X Get Y', icon: Gift },
  { value: 'bulk_pricing', label: 'Bulk Pricing', icon: TrendingUp },
];

const Promotions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    promotion_type: 'percentage_discount',
    discount_value: 0,
    min_purchase_amount: '',
    min_quantity: '',
    max_uses: '',
    applies_to: 'all',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const bizId = localStorage.getItem('currentBusinessId');
      if (!bizId) throw new Error('No business selected');
      const { error } = await supabase.from('promotions').insert({
        name: form.name,
        business_id: bizId,
        description: form.description || null,
        promotion_type: form.promotion_type,
        discount_value: form.discount_value,
        min_purchase_amount: form.min_purchase_amount ? parseFloat(form.min_purchase_amount) : null,
        min_quantity: form.min_quantity ? parseInt(form.min_quantity) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        applies_to: form.applies_to,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_active: true,
        created_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promotion created');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setShowDialog(false);
      setForm({ name: '', description: '', promotion_type: 'percentage_discount', discount_value: 0, min_purchase_amount: '', min_quantity: '', max_uses: '', applies_to: 'all', start_date: new Date().toISOString().split('T')[0], end_date: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('promotions').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promotion updated');
    },
  });

  const activeCount = promotions?.filter(p => p.is_active).length || 0;
  const totalDiscount = promotions?.filter(p => p.is_active).reduce((s, p) => s + Number(p.current_uses), 0) || 0;

  const isExpired = (endDate: string | null) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  const getStatusBadge = (promo: any) => {
    if (!promo.is_active) return <Badge className="bg-muted text-muted-foreground">Inactive</Badge>;
    if (isExpired(promo.end_date)) return <Badge className="bg-destructive/10 text-destructive">Expired</Badge>;
    if (new Date(promo.start_date) > new Date()) return <Badge className="bg-info/10 text-info">Scheduled</Badge>;
    return <Badge className="bg-success/10 text-success">Active</Badge>;
  };

  const getTypeLabel = (type: string) => promotionTypes.find(t => t.value === type)?.label || type;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Promotions</h1>
            <p className="text-sm text-muted-foreground">Discount campaigns, bulk pricing & special offers</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Promotion</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Promotion</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Campaign Name</Label>
                  <Input placeholder="e.g. Weekend Sale, Back to School" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea placeholder="Optional details..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={form.promotion_type} onValueChange={v => setForm(p => ({ ...p, promotion_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {promotionTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {form.promotion_type === 'percentage_discount' ? 'Discount %' : 'Discount Amount (KES)'}
                    </Label>
                    <Input type="number" min={0} value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date (optional)</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min Purchase (KES)</Label>
                    <Input type="number" placeholder="No minimum" value={form.min_purchase_amount} onChange={e => setForm(p => ({ ...p, min_purchase_amount: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Uses</Label>
                    <Input type="number" placeholder="Unlimited" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Applies To</Label>
                  <Select value={form.applies_to} onValueChange={v => setForm(p => ({ ...p, applies_to: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="specific_products">Specific Products</SelectItem>
                      <SelectItem value="specific_categories">Specific Categories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Promotion'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><Zap className="w-5 h-5 text-success" /></div>
              <div>
                <p className="text-2xs text-muted-foreground">Active Campaigns</p>
                <p className="text-xl font-bold">{activeCount}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Tag className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xs text-muted-foreground">Total Promotions</p>
                <p className="text-xl font-bold">{promotions?.length || 0}</p>
              </div>
            </div>
          </Card>
          <Card variant="stat" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-warning" /></div>
              <div>
                <p className="text-2xs text-muted-foreground">Total Redemptions</p>
                <p className="text-xl font-bold">{totalDiscount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Promotions List */}
        <div className="grid gap-3">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading promotions...</Card>
          ) : promotions?.length === 0 ? (
            <Card className="p-8 text-center">
              <Gift className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No promotions yet. Create your first campaign!</p>
            </Card>
          ) : promotions?.map(promo => (
            <Card key={promo.id} variant="default" className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{promo.name}</h3>
                    {getStatusBadge(promo)}
                  </div>
                  {promo.description && <p className="text-xs text-muted-foreground mb-2">{promo.description}</p>}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {getTypeLabel(promo.promotion_type)}: {promo.discount_value}{promo.promotion_type === 'percentage_discount' ? '%' : ' KES'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(promo.start_date), 'dd MMM')}
                      {promo.end_date ? ` — ${format(new Date(promo.end_date), 'dd MMM')}` : ' — No end'}
                    </span>
                    {promo.max_uses && (
                      <span>{promo.current_uses}/{promo.max_uses} uses</span>
                    )}
                  </div>
                </div>
                <Switch
                  checked={promo.is_active}
                  onCheckedChange={checked => toggleMutation.mutate({ id: promo.id, is_active: checked })}
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Promotions;
