import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanPrice {
  id: string;
  plan_id: string;
  currency: string;
  price_monthly: number;
  price_yearly: number;
  price_yearly_discounted: number | null;
  effective_from: string;
  effective_to: string | null;
  status: string;
}

export interface PriceQuote {
  plan_id: string;
  cycle: BillingCycle;
  currency: string;
  base_amount: number;
  final_amount: number;
  total_discount: number;
  override_type: string | null;
  override_id: string | null;
  is_grandfathered: boolean;
  promo_status: string | null;
  promo_id: string | null;
  promo_discount: number;
}

const db = supabase as any;

/** All currently effective plan prices, keyed by plan. Pricing is data, never code. */
export const usePlanPrices = () =>
  useQuery({
    queryKey: ['plan-prices'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await db
        .from('plan_prices')
        .select('*')
        .eq('status', 'active')
        .lte('effective_from', nowIso)
        .order('effective_from', { ascending: false });
      if (error) throw error;
      const map = new Map<string, PlanPrice>();
      (data ?? []).forEach((row: PlanPrice) => {
        if (row.effective_to && new Date(row.effective_to) <= new Date()) return;
        if (!map.has(row.plan_id)) map.set(row.plan_id, row);
      });
      return map;
    },
    staleTime: 10 * 60_000,
  });

/** Future scheduled prices — surfaced to admins so upcoming changes are visible. */
export const useScheduledPlanPrices = () =>
  useQuery({
    queryKey: ['plan-prices-scheduled'],
    queryFn: async () => {
      const { data, error } = await db
        .from('plan_prices')
        .select('*')
        .gt('effective_from', new Date().toISOString())
        .order('effective_from');
      if (error) throw error;
      return (data ?? []) as PlanPrice[];
    },
    staleTime: 10 * 60_000,
  });

/**
 * Server-authoritative price for this business. Applies plan price, business
 * overrides (grandfathering, waivers, negotiated rates) and coupons.
 */
export const usePriceQuote = (planId?: string, cycle: BillingCycle = 'monthly', coupon?: string) => {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  return useQuery({
    queryKey: ['price-quote', businessId, planId, cycle, coupon ?? ''],
    queryFn: async () => {
      const { data, error } = await db.rpc('calculate_subscription_price', {
        p_business_id: businessId,
        p_plan_id: planId,
        p_cycle: cycle,
        p_coupon: coupon || null,
      });
      if (error) throw error;
      return data as PriceQuote;
    },
    enabled: !!businessId && !!planId,
    staleTime: 60_000,
  });
};

/** Active pricing overrides for the current business (read-only for members). */
export const useBusinessPriceOverrides = () => {
  const { currentBusiness } = useBusiness();
  return useQuery({
    queryKey: ['price-overrides', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('business_price_overrides')
        .select('*')
        .eq('business_id', currentBusiness!.id)
        .eq('status', 'active');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60_000,
  });
};

export const useIsPlatformAdmin = () =>
  useQuery({
    queryKey: ['is-platform-admin'],
    queryFn: async () => {
      const { data, error } = await db.rpc('is_platform_admin');
      if (error) return false;
      return !!data;
    },
    staleTime: 30 * 60_000,
  });
