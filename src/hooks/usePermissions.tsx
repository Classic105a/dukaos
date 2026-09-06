import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';
import {
  resolvePermissions,
  resolveEffectiveRole,
  NO_PERMISSIONS,
  type BusinessMembership,
  type BusinessRole,
  type Permissions,
} from '@/lib/permissions';

export type AppRole = BusinessRole;
export type { Permissions };

/**
 * Authoritative frontend permission source (UI visibility only).
 *
 *   authenticated user → selected business → business_users membership
 *   → resolvePermissions() → UI
 *
 * The query is keyed by BOTH user and business, so switching businesses
 * recomputes from scratch and nothing leaks between tenants. When the user
 * has no active membership in the selected business every flag is false.
 * The database (RLS + RPCs) remains the real authorization boundary.
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const { currentBusiness, isLoading: businessLoading } = useBusiness();
  const businessId = currentBusiness?.id ?? null;

  const { data: membership, isLoading } = useQuery({
    queryKey: ['business-membership', user?.id, businessId],
    queryFn: async (): Promise<BusinessMembership | null> => {
      if (!user?.id || !businessId) return null;
      const { data, error } = await supabase
        .from('business_users')
        .select('business_id, user_id, role, is_owner, status')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle();
      if (error) return null;
      return (data as BusinessMembership | null) ?? null;
    },
    enabled: !!user?.id && !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  const permissions = businessId ? resolvePermissions(membership) : NO_PERMISSIONS;
  const role = businessId ? resolveEffectiveRole(membership) : null;

  return {
    role,
    membership: membership ?? null,
    businessId,
    permissions,
    isLoading: businessLoading || (!!businessId && isLoading),
    ...permissions,
  };
};

export default usePermissions;
