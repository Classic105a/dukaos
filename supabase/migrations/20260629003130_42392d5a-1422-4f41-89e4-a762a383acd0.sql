
-- 1. returns INSERT
DROP POLICY IF EXISTS "Authenticated users can create returns" ON public.returns;
CREATE POLICY "Members create returns in their branch"
ON public.returns FOR INSERT TO authenticated
WITH CHECK (
  business_id IS NOT NULL
  AND public.is_member_of_business(business_id)
  AND EXISTS (
    SELECT 1 FROM public.branch_users bu
    WHERE bu.branch_id = returns.branch_id AND bu.user_id = auth.uid()
  )
);

-- 2. grn_items
DROP POLICY IF EXISTS "Members view GRN items in their business" ON public.grn_items;
CREATE POLICY "Members view GRN items in their business"
ON public.grn_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goods_received_notes grn
    WHERE grn.id = grn_items.grn_id
      AND grn.business_id IS NOT NULL
      AND public.is_member_of_business(grn.business_id)
  )
);

-- 3. purchase_order_items
DROP POLICY IF EXISTS "Members view PO items in their business" ON public.purchase_order_items;
CREATE POLICY "Members view PO items in their business"
ON public.purchase_order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND po.business_id IS NOT NULL
      AND public.is_member_of_business(po.business_id)
  )
);

-- 4. Hash existing plaintext manager PINs and drop redundant column
UPDATE public.profiles
SET pin_hash = extensions.crypt(manager_pin, extensions.gen_salt('bf'))
WHERE manager_pin IS NOT NULL
  AND manager_pin <> ''
  AND (pin_hash IS NULL OR pin_hash = '');
ALTER TABLE public.profiles DROP COLUMN IF EXISTS manager_pin;

-- 5. Replace verify_manager_pin with bcrypt-based, service-role-only function
DROP FUNCTION IF EXISTS public.verify_manager_pin(text);
CREATE FUNCTION public.verify_manager_pin(p_pin text)
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, ur.role::text
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.pin_hash IS NOT NULL
    AND p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
    AND ur.role IN ('owner','admin','manager');
END;
$$;
REVOKE ALL ON FUNCTION public.verify_manager_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manager_pin(text) TO service_role;

-- 6. Lock down other SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.audit_logs_hash_chain() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_edits_on_closed_shift() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_branch_user_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_branch_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stamp_business_from_branch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_current_stock() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_member_of_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_business(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.business_id_from_branch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_id_from_branch(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_product_stock(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_stock(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_daily_sales_summary(uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_sales_summary(uuid, date, date, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.next_receipt_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_manager_credentials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_manager_credentials(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_sale(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_sale(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb, text, uuid) TO authenticated;

-- 7. branch-logos: drop public listing policy (files still served via public object URLs)
DROP POLICY IF EXISTS "Branch logos are publicly accessible" ON storage.objects;

-- 8. Move pgTAP out of public schema
DROP EXTENSION IF EXISTS pgtap;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
