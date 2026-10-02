CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _business_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _business_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id AND business_id = _business_id AND status = 'active'
      AND (role = ANY(_roles) OR (is_owner = true AND 'owner' = ANY(_roles)))
  )
$$;

CREATE POLICY "Members can add customers in their business"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (business_id IS NOT NULL AND has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager','cashier','attendant','staff']));