import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface CustomPermission {
  id: string;
  user_id: string;
  business_id: string | null;
  can_apply_discounts: boolean;
  can_void_cart_items: boolean;
  can_edit_past_sales: boolean;
  can_change_prices: boolean;
  can_view_purchase_prices: boolean;
  can_edit_stock_levels: boolean;
  can_perform_transfers: boolean;
  can_see_stock_value: boolean;
  can_view_net_profit: boolean;
  can_access_wallet: boolean;
  can_approve_withdrawals: boolean;
  can_see_payables: boolean;
  can_add_delete_staff: boolean;
  can_change_settings: boolean;
  can_export_data: boolean;
}

export const PERMISSION_GROUPS = {
  sales: {
    label: 'Sales',
    permissions: [
      { key: 'can_apply_discounts', label: 'Apply discounts' },
      { key: 'can_void_cart_items', label: 'Delete/void cart items' },
      { key: 'can_edit_past_sales', label: 'Edit past sales' },
      { key: 'can_change_prices', label: 'Change item prices at checkout' },
    ],
  },
  inventory: {
    label: 'Inventory',
    permissions: [
      { key: 'can_view_purchase_prices', label: 'View purchase prices' },
      { key: 'can_edit_stock_levels', label: 'Edit stock levels' },
      { key: 'can_perform_transfers', label: 'Perform warehouse transfers' },
      { key: 'can_see_stock_value', label: 'See total stock value' },
    ],
  },
  finance: {
    label: 'Finance',
    permissions: [
      { key: 'can_view_net_profit', label: 'View Net Profit' },
      { key: 'can_access_wallet', label: 'Access Business Wallet' },
      { key: 'can_approve_withdrawals', label: 'Approve withdrawals' },
      { key: 'can_see_payables', label: 'See Payables ledger' },
    ],
  },
  system: {
    label: 'System',
    permissions: [
      { key: 'can_add_delete_staff', label: 'Add/delete staff' },
      { key: 'can_change_settings', label: 'Change business settings' },
      { key: 'can_export_data', label: 'Export data to Excel' },
    ],
  },
} as const;

export const useCustomPermissions = (userId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const targetUserId = userId || user?.id;

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['custom-permissions', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      const { data, error } = await supabase
        .from('custom_permissions')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (error) throw error;
      return data as CustomPermission | null;
    },
    enabled: !!targetUserId,
  });

  const updatePermissions = useMutation({
    mutationFn: async (updates: Partial<CustomPermission> & { user_id: string }) => {
      const { user_id, ...permData } = updates;
      
      // Check if record exists
      const { data: existing } = await supabase
        .from('custom_permissions')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('custom_permissions')
          .update(permData)
          .eq('user_id', user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_permissions')
          .insert({ user_id, ...permData });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-permissions'] });
      toast({ title: 'Permissions updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Helper to check a specific permission
  const hasPermission = (key: keyof Omit<CustomPermission, 'id' | 'user_id' | 'business_id'>) => {
    return permissions?.[key] ?? false;
  };

  return { permissions, isLoading, updatePermissions, hasPermission };
};
