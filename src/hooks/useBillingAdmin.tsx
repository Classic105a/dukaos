import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface AdminBusinessRow {
  id: string;
  name: string;
  subscription: any;
}

/** All businesses + their subscription — platform admin only (RLS enforced). */
export const useAdminBusinesses = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin-businesses'],
    queryFn: async () => {
      const { data, error } = await db
        .from('business_subscriptions')
        .select('*, business:businesses(id, name, industry), plan:subscription_plans(id, name, code)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

/** Subscription invoices awaiting confirmation — platform admin only. */
export const useAdminInvoices = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const { data, error } = await db
        .from('subscription_invoices')
        .select('*, business:businesses(id, name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

export const useAdminPlanPrices = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin-plan-prices'],
    queryFn: async () => {
      const { data, error } = await db
        .from('plan_prices')
        .select('*, plan:subscription_plans(name, code)')
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

export const useAdminOverrides = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin-overrides'],
    queryFn: async () => {
      const { data, error } = await db
        .from('business_price_overrides')
        .select('*, business:businesses(name), plan:subscription_plans(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

export const useAdminPromotions = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const { data, error } = await db.from('billing_promotions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });

export const useBillingAuditLog = (businessId?: string) =>
  useQuery({
    queryKey: ['billing-audit', businessId ?? 'all'],
    queryFn: async () => {
      let q = db.from('billing_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
      if (businessId) q = q.eq('business_id', businessId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

/** All billing mutations funnel through here so every change is audited. */
export const useBillingMutations = () => {
  const qc = useQueryClient();
  const invalidate = () =>
    ['admin-plan-prices', 'admin-overrides', 'admin-promotions', 'admin-businesses', 'admin-invoices', 'plan-prices', 'billing-audit', 'price-quote']
      .forEach(key => qc.invalidateQueries({ queryKey: [key] }));

  const audit = async (payload: {
    business_id?: string | null; action: string; entity_type: string;
    entity_id?: string | null; new_values?: unknown; reason?: string | null;
  }) => {
    await db.rpc('log_billing_action', {
      p_business_id: payload.business_id ?? null,
      p_action: payload.action,
      p_entity_type: payload.entity_type,
      p_entity_id: payload.entity_id ?? null,
      p_old: null,
      p_new: payload.new_values ?? null,
      p_reason: payload.reason ?? null,
    });
  };

  const savePrice = useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await db.from('plan_prices').upsert(row).select().single();
      if (error) throw error;
      await audit({ action: row.id ? 'PRICE_UPDATED' : 'PRICE_CREATED', entity_type: 'plan_price', entity_id: data.id, new_values: data, reason: row.notes });
      return data;
    },
    onSuccess: invalidate,
  });

  const saveOverride = useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await db.from('business_price_overrides').upsert(row).select().single();
      if (error) throw error;
      await audit({ business_id: data.business_id, action: 'PRICE_OVERRIDE_SET', entity_type: 'business_price_override', entity_id: data.id, new_values: data, reason: data.reason });
      return data;
    },
    onSuccess: invalidate,
  });

  const savePromotion = useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await db.from('billing_promotions').upsert(row).select().single();
      if (error) throw error;
      await audit({ action: row.id ? 'PROMOTION_UPDATED' : 'PROMOTION_CREATED', entity_type: 'billing_promotion', entity_id: data.id, new_values: data });
      return data;
    },
    onSuccess: invalidate,
  });

  const subscriptionAction = useMutation({
    mutationFn: async (vars: { businessId: string; action: string; days?: number; planId?: string; reason?: string }) => {
      const { data, error } = await db.rpc('admin_subscription_action', {
        p_business_id: vars.businessId,
        p_action: vars.action,
        p_days: vars.days ?? null,
        p_plan_id: vars.planId ?? null,
        p_reason: vars.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const invoiceStatus = useMutation({
    mutationFn: async (vars: { invoiceId: string; status: string; reason?: string }) => {
      const { data, error } = await db.rpc('admin_update_invoice_status', {
        p_invoice_id: vars.invoiceId,
        p_status: vars.status,
        p_reason: vars.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  return { savePrice, saveOverride, savePromotion, subscriptionAction, invoiceStatus };
};
