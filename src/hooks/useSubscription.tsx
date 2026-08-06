import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { defaultModulesForIndustry, ModuleKey } from '@/lib/industry-modules';

export type SubscriptionStatus = 'trialing' | 'active' | 'grace' | 'expired' | 'cancelled';

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_branches: number | null;
  max_employees: number | null;
  max_products: number | null;
  max_warehouses: number | null;
  storage_mb: number | null;
  features: Record<string, unknown>;
  support_level: string;
  sort_order: number;
}

const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

const daysBetween = (target: string | null) =>
  target ? Math.ceil((new Date(target).getTime() - Date.now()) / DAY_MS) : null;

export const usePlans = () =>
  useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as SubscriptionPlan[];
    },
    staleTime: 30 * 60_000,
  });

export const useSubscription = () => {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  const query = useQuery({
    queryKey: ['business-subscription', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('business_id', businessId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });

  const sub = query.data as any;

  const derived = useMemo(() => {
    if (!sub) {
      return {
        status: 'trialing' as SubscriptionStatus,
        daysRemaining: null as number | null,
        isReadOnly: false,
        inGrace: false,
        plan: null as SubscriptionPlan | null,
      };
    }

    const plan = (sub.plan ?? null) as SubscriptionPlan | null;
    const isTrial = sub.status === 'trialing';
    const anchor: string | null = isTrial ? sub.trial_ends_at : sub.current_period_end;
    const daysRemaining = daysBetween(anchor);

    let status: SubscriptionStatus = sub.status as SubscriptionStatus;
    if (sub.status === 'cancelled') {
      status = 'cancelled';
    } else if (daysRemaining !== null && daysRemaining <= 0) {
      const graceEnd =
        sub.grace_period_ends_at ??
        (anchor ? new Date(new Date(anchor).getTime() + GRACE_DAYS * DAY_MS).toISOString() : null);
      const graceDays = daysBetween(graceEnd);
      status = graceDays !== null && graceDays > 0 ? 'grace' : 'expired';
    }

    return {
      status,
      daysRemaining,
      inGrace: status === 'grace',
      // Read-only lockout only once the grace period has fully elapsed.
      isReadOnly: status === 'expired' || status === 'cancelled',
      plan,
    };
  }, [sub]);

  /** Plan feature flag lookup — never hardcode plan checks at call sites. */
  const hasFeature = (feature: string): boolean => {
    const value = derived.plan?.features?.[feature];
    return value === true || (typeof value === 'string' && value !== 'none');
  };

  /** Plan limit lookup. `null` means unlimited. */
  const limit = (key: 'branches' | 'employees' | 'products' | 'warehouses'): number | null => {
    const plan = derived.plan;
    if (!plan) return null;
    return (plan as any)[`max_${key}`] ?? null;
  };

  const withinLimit = (key: 'branches' | 'employees' | 'products' | 'warehouses', current: number) => {
    const max = limit(key);
    return max === null || current < max;
  };

  return {
    subscription: sub ?? null,
    ...derived,
    hasFeature,
    limit,
    withinLimit,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

export const useSubscriptionInvoices = () => {
  const { currentBusiness } = useBusiness();
  return useQuery({
    queryKey: ['subscription-invoices', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select('*')
        .eq('business_id', currentBusiness!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentBusiness?.id,
  });
};

/**
 * Per-business module registry. Falls back to the industry defaults until the
 * business explicitly overrides a module.
 */
export const useBusinessModules = () => {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const businessId = currentBusiness?.id;
  const industry = (currentBusiness as any)?.industry ?? (currentBusiness as any)?.type ?? 'retail';

  const query = useQuery({
    queryKey: ['business-modules', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_modules')
        .select('module_key, is_enabled')
        .eq('business_id', businessId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });

  const overrides = useMemo(() => {
    const map = new Map<string, boolean>();
    (query.data ?? []).forEach((row: any) => map.set(row.module_key, row.is_enabled));
    return map;
  }, [query.data]);

  const defaults = useMemo(() => new Set(defaultModulesForIndustry(industry)), [industry]);

  const isModuleEnabled = (key: ModuleKey) =>
    overrides.has(key) ? !!overrides.get(key) : defaults.has(key);

  const setModule = useMutation({
    mutationFn: async ({ key, enabled }: { key: ModuleKey; enabled: boolean }) => {
      if (!businessId) throw new Error('No business selected');
      const { error } = await supabase
        .from('business_modules')
        .upsert(
          { business_id: businessId, module_key: key, is_enabled: enabled },
          { onConflict: 'business_id,module_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-modules', businessId] });
    },
  });

  return {
    industry,
    isModuleEnabled,
    setModule,
    isLoading: query.isLoading,
  };
};