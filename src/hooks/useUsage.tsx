import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useSubscription } from './useSubscription';

export type LimitKey = 'branches' | 'employees' | 'products' | 'warehouses';

export interface UsageRow {
  key: LimitKey;
  label: string;
  used: number;
  allowed: number | null;
  remaining: number | null;
  percent: number;
  exceeded: boolean;
}

const count = async (table: string, businessId: string, extra?: (q: any) => any) => {
  let q = (supabase as any).from(table).select('id', { count: 'exact', head: true }).eq('business_id', businessId);
  if (extra) q = extra(q);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
};

/** Centralized live usage vs plan limits. Never count entities at call sites. */
export const useUsage = () => {
  const { currentBusiness } = useBusiness();
  const { limit } = useSubscription();
  const businessId = currentBusiness?.id;

  const query = useQuery({
    queryKey: ['plan-usage', businessId],
    queryFn: async () => {
      const [branches, employees, products] = await Promise.all([
        count('branches', businessId!),
        count('business_users', businessId!, q => q.eq('status', 'active')),
        count('products', businessId!, q => q.eq('is_active', true)),
      ]);
      return { branches, employees, products, warehouses: 0 };
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  const raw = query.data ?? { branches: 0, employees: 0, products: 0, warehouses: 0 };

  const build = (key: LimitKey, label: string): UsageRow => {
    const used = raw[key];
    const allowed = limit(key);
    return {
      key,
      label,
      used,
      allowed,
      remaining: allowed === null ? null : Math.max(allowed - used, 0),
      percent: allowed === null || allowed === 0 ? 0 : Math.min((used / allowed) * 100, 100),
      exceeded: allowed !== null && used >= allowed,
    };
  };

  const rows: UsageRow[] = [
    build('branches', 'Branches'),
    build('employees', 'Team members'),
    build('products', 'Products'),
    build('warehouses', 'Warehouses'),
  ];

  const usageFor = (key: LimitKey) => rows.find(r => r.key === key)!;
  /** True when the business may still create one more entity of this type. */
  const canCreate = (key: LimitKey) => !usageFor(key).exceeded;

  return { rows, usageFor, canCreate, counts: raw, isLoading: query.isLoading, refetch: query.refetch };
};
