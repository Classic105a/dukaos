CREATE OR REPLACE FUNCTION public.manages_user_in_own_business(_target_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users me
    JOIN public.business_users target ON target.business_id = me.business_id
    WHERE me.user_id = auth.uid()
      AND me.status = 'active'
      AND (me.is_owner = true OR me.role IN ('owner','admin'))
      AND target.user_id = _target_user
  )
$$;
REVOKE ALL ON FUNCTION public.manages_user_in_own_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manages_user_in_own_business(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Owners and admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role or admins view all" ON public.user_roles;

CREATE POLICY "View own role or roles of own-business staff"
ON public.user_roles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_platform_admin()
  OR public.manages_user_in_own_business(user_id)
);

CREATE POLICY "Manage roles of own-business staff"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin() OR public.manages_user_in_own_business(user_id));

CREATE POLICY "Update roles of own-business staff"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_platform_admin() OR public.manages_user_in_own_business(user_id))
WITH CHECK (public.is_platform_admin() OR public.manages_user_in_own_business(user_id));

CREATE POLICY "Delete roles of own-business staff"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_platform_admin() OR public.manages_user_in_own_business(user_id));