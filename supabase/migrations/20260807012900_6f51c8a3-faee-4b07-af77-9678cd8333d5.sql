
-- ─────────────── PLATFORM ADMINS ───────────────
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read admin list" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

-- ─────────────── PLAN PRICES ───────────────
CREATE TABLE public.plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'KES',
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly_discounted numeric(12,2),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_prices_lookup ON public.plan_prices(plan_id, status, effective_from DESC);
GRANT SELECT ON public.plan_prices TO authenticated, anon;
GRANT ALL ON public.plan_prices TO service_role;
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read active prices" ON public.plan_prices FOR SELECT USING (true);
CREATE POLICY "platform admins manage prices" ON public.plan_prices FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE TRIGGER trg_plan_prices_updated BEFORE UPDATE ON public.plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed current plan prices from the legacy columns (kept for backward compatibility)
INSERT INTO public.plan_prices (plan_id, currency, price_monthly, price_yearly, notes)
SELECT id, currency, price_monthly, price_yearly, 'Seeded from subscription_plans'
FROM public.subscription_plans;

-- ─────────────── BUSINESS PRICING OVERRIDES ───────────────
CREATE TABLE public.business_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  override_type text NOT NULL,
  custom_monthly numeric(12,2),
  custom_yearly numeric(12,2),
  discount_percent numeric(5,2),
  discount_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'KES',
  is_grandfathered boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  approved_by uuid,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bpo_business ON public.business_price_overrides(business_id, status);
GRANT SELECT ON public.business_price_overrides TO authenticated;
GRANT ALL ON public.business_price_overrides TO service_role;
ALTER TABLE public.business_price_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own overrides" ON public.business_price_overrides FOR SELECT TO authenticated
  USING (public.is_member_of_business(business_id) OR public.is_platform_admin());
CREATE POLICY "platform admins manage overrides" ON public.business_price_overrides FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE TRIGGER trg_bpo_updated BEFORE UPDATE ON public.business_price_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────── PROMOTION / COUPON ENGINE ───────────────
CREATE TABLE public.billing_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL,
  discount_value numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  applies_to_plan_ids uuid[],
  applies_to_cycles text[] NOT NULL DEFAULT ARRAY['monthly','yearly'],
  max_redemptions integer,
  max_per_business integer NOT NULL DEFAULT 1,
  current_redemptions integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_promotions TO authenticated;
GRANT ALL ON public.billing_promotions TO service_role;
ALTER TABLE public.billing_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read active promos" ON public.billing_promotions FOR SELECT TO authenticated
  USING (is_active = true OR public.is_platform_admin());
CREATE POLICY "platform admins manage promos" ON public.billing_promotions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE TRIGGER trg_billing_promos_updated BEFORE UPDATE ON public.billing_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.billing_promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.billing_promotions(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  discount_applied numeric(12,2) NOT NULL DEFAULT 0,
  redeemed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bpr_business ON public.billing_promotion_redemptions(business_id);
GRANT SELECT ON public.billing_promotion_redemptions TO authenticated;
GRANT ALL ON public.billing_promotion_redemptions TO service_role;
ALTER TABLE public.billing_promotion_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own redemptions" ON public.billing_promotion_redemptions FOR SELECT TO authenticated
  USING (public.is_member_of_business(business_id) OR public.is_platform_admin());

-- ─────────────── BILLING AUDIT LOG ───────────────
CREATE TABLE public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_audit_business ON public.billing_audit_log(business_id, created_at DESC);
GRANT SELECT ON public.billing_audit_log TO authenticated;
GRANT ALL ON public.billing_audit_log TO service_role;
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own billing audit" ON public.billing_audit_log FOR SELECT TO authenticated
  USING ((business_id IS NOT NULL AND public.is_member_of_business(business_id)) OR public.is_platform_admin());

-- ─────────────── PRICE RESOLVER ───────────────
CREATE OR REPLACE FUNCTION public.calculate_subscription_price(
  p_business_id uuid,
  p_plan_id uuid,
  p_cycle text DEFAULT 'monthly',
  p_coupon text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_price public.plan_prices;
  v_override public.business_price_overrides;
  v_promo public.billing_promotions;
  v_base numeric(12,2) := 0;
  v_final numeric(12,2) := 0;
  v_currency text := 'KES';
  v_promo_discount numeric(12,2) := 0;
  v_override_note text := NULL;
  v_promo_note text := NULL;
  v_redeemed int := 0;
BEGIN
  IF p_cycle NOT IN ('monthly','yearly') THEN
    RAISE EXCEPTION 'Invalid billing cycle: %', p_cycle;
  END IF;

  SELECT * INTO v_price FROM public.plan_prices
   WHERE plan_id = p_plan_id AND status = 'active'
     AND effective_from <= now()
     AND (effective_to IS NULL OR effective_to > now())
   ORDER BY effective_from DESC LIMIT 1;

  IF v_price.id IS NULL THEN
    SELECT currency, price_monthly, price_yearly
      INTO v_currency, v_base, v_final
      FROM public.subscription_plans WHERE id = p_plan_id;
    v_base := CASE WHEN p_cycle = 'monthly' THEN v_base ELSE v_final END;
  ELSE
    v_currency := v_price.currency;
    v_base := CASE WHEN p_cycle = 'monthly' THEN v_price.price_monthly
                   ELSE COALESCE(v_price.price_yearly_discounted, v_price.price_yearly) END;
  END IF;

  v_final := COALESCE(v_base, 0);

  -- Business override (grandfathered / negotiated / waiver)
  SELECT * INTO v_override FROM public.business_price_overrides
   WHERE business_id = p_business_id
     AND status = 'active'
     AND (plan_id IS NULL OR plan_id = p_plan_id)
     AND start_date <= now()
     AND (end_date IS NULL OR end_date > now())
   ORDER BY plan_id NULLS LAST, start_date DESC LIMIT 1;

  IF v_override.id IS NOT NULL THEN
    v_override_note := v_override.override_type;
    IF v_override.override_type IN ('waiver','lifetime_free') THEN
      v_final := 0;
    ELSIF v_override.override_type = 'custom_price' THEN
      v_final := COALESCE(
        CASE WHEN p_cycle = 'monthly' THEN v_override.custom_monthly ELSE v_override.custom_yearly END,
        v_final);
    ELSIF v_override.override_type IN ('percent_discount','temporary_discount') THEN
      v_final := ROUND(v_final * (1 - COALESCE(v_override.discount_percent,0)/100.0), 2);
    ELSIF v_override.override_type = 'fixed_discount' THEN
      v_final := GREATEST(v_final - COALESCE(v_override.discount_amount,0), 0);
    END IF;
  END IF;

  -- Coupon
  IF p_coupon IS NOT NULL AND length(trim(p_coupon)) > 0 AND v_final > 0 THEN
    SELECT * INTO v_promo FROM public.billing_promotions
     WHERE upper(code) = upper(trim(p_coupon)) AND is_active = true;

    IF v_promo.id IS NULL THEN
      v_promo_note := 'invalid_code';
    ELSIF v_promo.starts_at > now() OR (v_promo.ends_at IS NOT NULL AND v_promo.ends_at < now()) THEN
      v_promo_note := 'expired';
    ELSIF v_promo.max_redemptions IS NOT NULL AND v_promo.current_redemptions >= v_promo.max_redemptions THEN
      v_promo_note := 'limit_reached';
    ELSIF NOT (p_cycle = ANY(v_promo.applies_to_cycles)) THEN
      v_promo_note := 'cycle_not_eligible';
    ELSIF v_promo.applies_to_plan_ids IS NOT NULL
          AND array_length(v_promo.applies_to_plan_ids,1) > 0
          AND NOT (p_plan_id = ANY(v_promo.applies_to_plan_ids)) THEN
      v_promo_note := 'plan_not_eligible';
    ELSE
      SELECT count(*) INTO v_redeemed FROM public.billing_promotion_redemptions
       WHERE promotion_id = v_promo.id AND business_id = p_business_id;
      IF v_redeemed >= v_promo.max_per_business THEN
        v_promo_note := 'already_redeemed';
      ELSE
        v_promo_discount := CASE
          WHEN v_promo.discount_type = 'percentage' THEN ROUND(v_final * v_promo.discount_value / 100.0, 2)
          ELSE LEAST(v_promo.discount_value, v_final) END;
        v_final := GREATEST(v_final - v_promo_discount, 0);
        v_promo_note := 'applied';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'cycle', p_cycle,
    'currency', v_currency,
    'base_amount', COALESCE(v_base,0),
    'final_amount', v_final,
    'total_discount', GREATEST(COALESCE(v_base,0) - v_final, 0),
    'override_type', v_override_note,
    'override_id', v_override.id,
    'is_grandfathered', COALESCE(v_override.is_grandfathered, false),
    'promo_status', v_promo_note,
    'promo_id', v_promo.id,
    'promo_discount', v_promo_discount
  );
END $$;

GRANT EXECUTE ON FUNCTION public.calculate_subscription_price(uuid, uuid, text, text) TO authenticated;
