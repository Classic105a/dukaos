-- 1) Non-recursive ownership helper
CREATE OR REPLACE FUNCTION public.is_business_owner(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE business_id = _business_id
      AND user_id = auth.uid()
      AND is_owner = true
  )
$$;

REVOKE ALL ON FUNCTION public.is_business_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO authenticated, service_role;

-- 2) Remove recursive policies on business_users
DROP POLICY IF EXISTS "Owners can manage business users" ON public.business_users;
DROP POLICY IF EXISTS "Members can view business users" ON public.business_users;

CREATE POLICY "Owners can manage business users"
ON public.business_users FOR ALL TO authenticated
USING (public.is_business_owner(business_id))
WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY "Members can view business users"
ON public.business_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_business_owner(business_id));

-- 3) Business-scope the permissive INSERT policies
DROP POLICY IF EXISTS "Staff can create credit transactions" ON public.credit_transactions;
CREATE POLICY "Staff can create credit transactions"
ON public.credit_transactions FOR INSERT TO authenticated
WITH CHECK (
  processed_by = auth.uid()
  AND public.is_member_of_business(business_id)
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_id AND c.business_id = credit_transactions.business_id
  )
);

DROP POLICY IF EXISTS "Staff can create installment plans" ON public.installment_plans;
CREATE POLICY "Staff can create installment plans"
ON public.installment_plans FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_member_of_business(business_id)
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_id AND c.business_id = installment_plans.business_id
  )
);

DROP POLICY IF EXISTS "Staff can create payables" ON public.payable_transactions;
CREATE POLICY "Staff can create payables"
ON public.payable_transactions FOR INSERT TO authenticated
WITH CHECK (
  processed_by = auth.uid()
  AND public.is_member_of_business(business_id)
  AND EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_id AND p.business_id = payable_transactions.business_id
  )
);