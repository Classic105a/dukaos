
-- Backfills
UPDATE public.products p SET business_id = b.business_id
  FROM public.branches b WHERE p.branch_id = b.id AND p.business_id IS NULL;
UPDATE public.stock_movements sm SET business_id = b.business_id
  FROM public.branches b WHERE sm.branch_id = b.id AND sm.business_id IS NULL;

ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS business_id uuid;
UPDATE public.stock_transfers st SET business_id = b.business_id
  FROM public.branches b WHERE COALESCE(st.from_branch_id, st.to_branch_id) = b.id AND st.business_id IS NULL;

ALTER TABLE public.receipt_settings ADD COLUMN IF NOT EXISTS business_id uuid;
UPDATE public.receipt_settings rs SET business_id = b.business_id
  FROM public.branches b WHERE rs.branch_id = b.id AND rs.business_id IS NULL;

UPDATE public.returns r SET business_id = b.business_id
  FROM public.branches b WHERE r.branch_id = b.id AND r.business_id IS NULL;
UPDATE public.reorder_rules rr SET business_id = b.business_id
  FROM public.branches b WHERE rr.branch_id = b.id AND rr.business_id IS NULL;

-- Tighten broad SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON public.stock_movements;
CREATE POLICY "Members view stock movements in their business" ON public.stock_movements FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Authenticated users can view transfers" ON public.stock_transfers;
CREATE POLICY "Members view transfers in their business" ON public.stock_transfers FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Authenticated users can view returns" ON public.returns;
CREATE POLICY "Members view returns in their business" ON public.returns FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Authenticated users can view receipt settings" ON public.receipt_settings;
CREATE POLICY "Members view receipt settings in their business" ON public.receipt_settings FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Auth users can view reorder rules" ON public.reorder_rules;
CREATE POLICY "Members view reorder rules in their business" ON public.reorder_rules FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

-- Remove NULL-business loophole
DROP POLICY IF EXISTS "Members view sync conflicts in their business" ON public.sync_conflicts;
CREATE POLICY "Members view sync conflicts in their business" ON public.sync_conflicts FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members can view products in their business" ON public.products;
CREATE POLICY "Members can view products in their business" ON public.products FOR SELECT
  USING (is_active = true AND business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view customers in their business" ON public.customers;
CREATE POLICY "Members view customers in their business" ON public.customers FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view categories in their business" ON public.categories;
CREATE POLICY "Members view categories in their business" ON public.categories FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view branches in their business" ON public.branches;
CREATE POLICY "Members view branches in their business" ON public.branches FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view stock in their business" ON public.current_stock;
CREATE POLICY "Members view stock in their business" ON public.current_stock FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view inventory in their business" ON public.branch_inventory;
CREATE POLICY "Members view inventory in their business" ON public.branch_inventory FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view parties in their business" ON public.parties;
CREATE POLICY "Members view parties in their business" ON public.parties FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view legal cases in their business" ON public.legal_cases;
CREATE POLICY "Members view legal cases in their business" ON public.legal_cases FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view payables in their business" ON public.payable_transactions;
CREATE POLICY "Members view payables in their business" ON public.payable_transactions FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view purchase orders in their business" ON public.purchase_orders;
CREATE POLICY "Members view purchase orders in their business" ON public.purchase_orders FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view GRNs in their business" ON public.goods_received_notes;
CREATE POLICY "Members view GRNs in their business" ON public.goods_received_notes FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view printers in their business" ON public.printer_configurations;
CREATE POLICY "Members view printers in their business" ON public.printer_configurations FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view installment plans in their business" ON public.installment_plans;
CREATE POLICY "Members view installment plans in their business" ON public.installment_plans FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view credit transactions in their business" ON public.credit_transactions;
CREATE POLICY "Members view credit transactions in their business" ON public.credit_transactions FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Members view promotions in their business" ON public.promotions;
CREATE POLICY "Members view promotions in their business" ON public.promotions FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

DROP POLICY IF EXISTS "Managers view audit logs in their business" ON public.audit_logs;
CREATE POLICY "Managers view audit logs in their business" ON public.audit_logs FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id)
    AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

DROP POLICY IF EXISTS "Managers view error logs in their business" ON public.error_logs;
CREATE POLICY "Managers view error logs in their business" ON public.error_logs FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id)
    AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

DROP POLICY IF EXISTS "Managers view perf metrics in their business" ON public.perf_metrics;
CREATE POLICY "Managers view perf metrics in their business" ON public.perf_metrics FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id)
    AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

DROP POLICY IF EXISTS "Managers view backup runs in their business" ON public.backup_runs;
CREATE POLICY "Managers view backup runs in their business" ON public.backup_runs FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id)
    AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

DROP POLICY IF EXISTS "Managers view mpesa callbacks in their business" ON public.mpesa_callbacks;
CREATE POLICY "Managers view mpesa callbacks in their business" ON public.mpesa_callbacks FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id)
    AND (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

DROP POLICY IF EXISTS "Members view promo redemptions in their business" ON public.promo_redemptions;
CREATE POLICY "Members view promo redemptions in their business" ON public.promo_redemptions FOR SELECT
  USING (business_id IS NOT NULL AND public.is_member_of_business(business_id));

-- Profiles: scope owner/admin reads to same-business
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
CREATE POLICY "Users view own profile or same-business admins" ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.business_users me
      JOIN public.business_users target ON target.business_id = me.business_id
      WHERE me.user_id = auth.uid()
        AND target.user_id = public.profiles.id
        AND (me.is_owner = true OR me.role IN ('owner','admin'))
    )
  );

-- Hash plaintext PINs (extensions.crypt / extensions.gen_salt)
UPDATE public.profiles
  SET manager_pin = extensions.crypt(manager_pin, extensions.gen_salt('bf'))
  WHERE manager_pin IS NOT NULL AND manager_pin ~ '^\d{4}$';

DROP FUNCTION IF EXISTS public.verify_manager_pin(text);
CREATE FUNCTION public.verify_manager_pin(p_pin text)
RETURNS TABLE(user_id uuid, user_email text, user_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, COALESCE(ur.role::text, 'attendant')
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.manager_pin IS NOT NULL
    AND p.manager_pin = extensions.crypt(p_pin, p.manager_pin)
    AND COALESCE(ur.role::text, '') IN ('owner','admin','manager')
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_manager_pin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_manager_pin(text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_manager_pin(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manager_pin(text) TO service_role;

ALTER FUNCTION public.is_member_of_business(uuid) SET search_path = public;
