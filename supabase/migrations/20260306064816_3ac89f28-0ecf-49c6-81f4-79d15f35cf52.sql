
-- 1. Create a SECURITY DEFINER function to verify manager PIN without exposing data
CREATE OR REPLACE FUNCTION public.verify_manager_pin(p_pin TEXT)
RETURNS TABLE(user_id UUID, user_email TEXT, user_role app_role)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.manager_pin = p_pin
    AND ur.role IN ('owner', 'admin', 'manager')
  LIMIT 1;
END;
$$;

-- 2. Create a SECURITY DEFINER function to verify manager credentials without session replacement
CREATE OR REPLACE FUNCTION public.verify_manager_credentials(p_user_id UUID)
RETURNS TABLE(user_email TEXT, user_role app_role)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.email, ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.id = p_user_id
    AND ur.role IN ('owner', 'admin', 'manager')
  LIMIT 1;
END;
$$;

-- 3. Fix profiles SELECT policy to hide manager_pin from non-admins
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;

-- Recreate: users see own profile, admins see all, but manager_pin is only in the column (we can't do column-level RLS so we handle in the RPC)
-- Keep the same policy but restrict to own + admin (already correct, the issue is the PIN query pattern)
CREATE POLICY "Users can view own profile or admins view all" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR has_role(auth.uid(), 'owner'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. Fix business_users INSERT policy - prevent privilege escalation
DROP POLICY IF EXISTS "Users can insert themselves" ON public.business_users;

CREATE POLICY "Users can only add themselves without owner" ON public.business_users
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (is_owner = false OR is_owner IS NULL)
  );
