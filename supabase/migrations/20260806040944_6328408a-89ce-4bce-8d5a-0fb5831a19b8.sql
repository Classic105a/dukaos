
-- 1. Business registration profile fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS kra_pin text,
  ADD COLUMN IF NOT EXISTS business_permit text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS till_number text,
  ADD COLUMN IF NOT EXISTS paybill_number text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi';

-- 2. Plan catalogue
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  max_branches integer,
  max_employees integer,
  max_products integer,
  max_warehouses integer,
  storage_mb integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  support_level text NOT NULL DEFAULT 'standard',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

-- 3. Business subscriptions
CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'trialing',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_subscriptions TO authenticated;
GRANT ALL ON public.business_subscriptions TO service_role;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view their subscription" ON public.business_subscriptions
  FOR SELECT TO authenticated USING (public.is_member_of_business(business_id));
CREATE POLICY "Owners manage subscription insert" ON public.business_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id));
CREATE POLICY "Owners manage subscription update" ON public.business_subscriptions
  FOR UPDATE TO authenticated
  USING (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id))
  WITH CHECK (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id));

-- 4. Subscription invoices
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.business_subscriptions(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  period_start timestamptz,
  period_end timestamptz,
  due_date date,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view invoices" ON public.subscription_invoices
  FOR SELECT TO authenticated USING (public.is_member_of_business(business_id));
CREATE POLICY "Owners create invoices" ON public.subscription_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id));
CREATE POLICY "Owners update invoices" ON public.subscription_invoices
  FOR UPDATE TO authenticated
  USING (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id))
  WITH CHECK (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id));
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_business ON public.subscription_invoices(business_id, created_at DESC);

-- 5. Per-business module registry
CREATE TABLE IF NOT EXISTS public.business_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_modules TO authenticated;
GRANT ALL ON public.business_modules TO service_role;
ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view modules" ON public.business_modules
  FOR SELECT TO authenticated USING (public.is_member_of_business(business_id));
CREATE POLICY "Owners manage modules" ON public.business_modules
  FOR ALL TO authenticated
  USING (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id))
  WITH CHECK (public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']) OR public.is_business_owner(business_id));

-- 6. updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_subscriptions_updated_at BEFORE UPDATE ON public.business_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscription_invoices_updated_at BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_modules_updated_at BEFORE UPDATE ON public.business_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Seed plan catalogue
INSERT INTO public.subscription_plans (code, name, description, price_monthly, price_yearly, max_branches, max_employees, max_products, max_warehouses, storage_mb, support_level, sort_order, features)
VALUES
  ('starter','Starter','For single-shop businesses getting started', 1500, 15000, 1, 3, 500, 1, 500, 'community', 1,
   '{"reports":"basic","ai":false,"api_access":false,"custom_branding":false}'::jsonb),
  ('growth','Growth','For growing businesses with a small team', 3500, 35000, 3, 10, 5000, 2, 2000, 'standard', 2,
   '{"reports":"standard","ai":false,"api_access":false,"custom_branding":false}'::jsonb),
  ('professional','Professional','Multi-branch operations with advanced insight', 7500, 75000, 10, 50, 50000, 5, 10000, 'priority', 3,
   '{"reports":"advanced","ai":true,"api_access":true,"custom_branding":true}'::jsonb),
  ('enterprise','Enterprise','Unlimited scale with dedicated support', 20000, 200000, NULL, NULL, NULL, NULL, 100000, 'dedicated', 4,
   '{"reports":"advanced","ai":true,"api_access":true,"custom_branding":true,"sso":true}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 8. Auto-provision a 60-day Starter trial for every business
CREATE OR REPLACE FUNCTION public.provision_business_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan uuid;
BEGIN
  SELECT id INTO v_plan FROM public.subscription_plans WHERE code = 'starter' LIMIT 1;
  INSERT INTO public.business_subscriptions (business_id, plan_id, status, billing_cycle)
  VALUES (NEW.id, v_plan, 'trialing', 'monthly')
  ON CONFLICT (business_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_provision_business_subscription ON public.businesses;
CREATE TRIGGER trg_provision_business_subscription
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.provision_business_subscription();

-- 9. Backfill trials for existing businesses
INSERT INTO public.business_subscriptions (business_id, plan_id, status, billing_cycle)
SELECT b.id, (SELECT id FROM public.subscription_plans WHERE code='starter'), 'trialing', 'monthly'
FROM public.businesses b
ON CONFLICT (business_id) DO NOTHING;
