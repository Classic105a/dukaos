import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'owner' | 'admin' | 'manager' | 'cashier';

interface Permissions {
  canViewProfit: boolean;
  canEditProducts: boolean;
  canProcessRefunds: boolean;
  canApproveRefunds: boolean;
  canManageInventory: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canManageBranches: boolean;
  canVoidSales: boolean;
  canApplyCreditSales: boolean;
  canManageCustomerCredit: boolean;
  canViewAuditLogs: boolean;
  canCloseShifts: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  canViewProfit: false,
  canEditProducts: false,
  canProcessRefunds: false,
  canApproveRefunds: false,
  canManageInventory: false,
  canManageUsers: false,
  canViewReports: false,
  canManageBranches: false,
  canVoidSales: false,
  canApplyCreditSales: false,
  canManageCustomerCredit: false,
  canViewAuditLogs: false,
  canCloseShifts: false,
  isManager: false,
  isAdmin: false,
  isOwner: false,
};

const getPermissionsForRole = (role: AppRole | null): Permissions => {
  if (!role) return DEFAULT_PERMISSIONS;

  switch (role) {
    case 'owner':
      return {
        canViewProfit: true,
        canEditProducts: true,
        canProcessRefunds: true,
        canApproveRefunds: true,
        canManageInventory: true,
        canManageUsers: true,
        canViewReports: true,
        canManageBranches: true,
        canVoidSales: true,
        canApplyCreditSales: true,
        canManageCustomerCredit: true,
        canViewAuditLogs: true,
        canCloseShifts: true,
        isManager: true,
        isAdmin: true,
        isOwner: true,
      };
    case 'admin':
      return {
        canViewProfit: true,
        canEditProducts: true,
        canProcessRefunds: true,
        canApproveRefunds: true,
        canManageInventory: true,
        canManageUsers: true,
        canViewReports: true,
        canManageBranches: true,
        canVoidSales: true,
        canApplyCreditSales: true,
        canManageCustomerCredit: true,
        canViewAuditLogs: true,
        canCloseShifts: true,
        isManager: true,
        isAdmin: true,
        isOwner: false,
      };
    case 'manager':
      return {
        canViewProfit: true,
        canEditProducts: true,
        canProcessRefunds: true,
        canApproveRefunds: true,
        canManageInventory: true,
        canManageUsers: false,
        canViewReports: true,
        canManageBranches: false,
        canVoidSales: true,
        canApplyCreditSales: true,
        canManageCustomerCredit: true,
        canViewAuditLogs: true,
        canCloseShifts: true,
        isManager: true,
        isAdmin: false,
        isOwner: false,
      };
    case 'cashier':
    default:
      return {
        canViewProfit: false,
        canEditProducts: false,
        canProcessRefunds: false, // Needs manager approval
        canApproveRefunds: false,
        canManageInventory: false,
        canManageUsers: false,
        canViewReports: false,
        canManageBranches: false,
        canVoidSales: false,
        canApplyCreditSales: false, // Needs manager approval
        canManageCustomerCredit: false,
        canViewAuditLogs: false,
        canCloseShifts: true, // Can close their own shift
        isManager: false,
        isAdmin: false,
        isOwner: false,
      };
  }
};

export const usePermissions = () => {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      if (error) return 'cashier' as AppRole;
      return data?.role as AppRole;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const permissions = getPermissionsForRole(role || null);

  return {
    role,
    permissions,
    isLoading,
    ...permissions,
  };
};

export default usePermissions;
