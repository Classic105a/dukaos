
DROP FUNCTION IF EXISTS public.verify_manager_pin(text);
CREATE FUNCTION public.verify_manager_pin(p_pin text)
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name,
         COALESCE(
           (SELECT bu.role FROM public.business_users bu
             WHERE bu.user_id = p.id AND bu.status = 'active'
               AND bu.role IN ('owner','admin','manager') LIMIT 1),
           (SELECT ur.role::text FROM public.user_roles ur
             WHERE ur.user_id = p.id
               AND ur.role IN ('owner','admin','manager') LIMIT 1)
         ) AS role
  FROM public.profiles p
  WHERE p.pin_hash IS NOT NULL
    AND p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
    AND (
      EXISTS (SELECT 1 FROM public.business_users bu
               WHERE bu.user_id = p.id AND bu.status = 'active'
                 AND bu.role IN ('owner','admin','manager'))
      OR EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = p.id
                    AND ur.role IN ('owner','admin','manager'))
    );
END;
$fn$;
REVOKE ALL ON FUNCTION public.verify_manager_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manager_pin(text) TO service_role;

DROP FUNCTION IF EXISTS public.verify_manager_credentials(uuid);
CREATE FUNCTION public.verify_manager_credentials(p_user_id uuid)
RETURNS TABLE(user_email text, user_role text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN QUERY
  SELECT p.email,
         COALESCE(
           (SELECT bu.role FROM public.business_users bu
             WHERE bu.user_id = p.id AND bu.status = 'active'
               AND bu.role IN ('owner','admin','manager') LIMIT 1),
           (SELECT ur.role::text FROM public.user_roles ur
             WHERE ur.user_id = p.id
               AND ur.role IN ('owner','admin','manager') LIMIT 1)
         )
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;
END;
$fn$;
REVOKE ALL ON FUNCTION public.verify_manager_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manager_credentials(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_full_name text;
  v_biz_id uuid;
  v_has_invite boolean;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email,'@',1));
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name)
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now()
  ) INTO v_has_invite;

  IF v_has_invite THEN RETURN NEW; END IF;

  INSERT INTO public.businesses (name, type, created_by)
  VALUES (COALESCE(v_full_name,'My Business') || '''s Business', 'retail', NEW.id)
  RETURNING id INTO v_biz_id;

  INSERT INTO public.business_users (business_id, user_id, role, is_owner, status)
  VALUES (v_biz_id, NEW.id, 'owner', true, 'active');

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS on_new_branch_assign_admins ON public.branches;
DROP TRIGGER IF EXISTS on_branch_created_assign_admins ON public.branches;
DROP TRIGGER IF EXISTS on_new_user_role_branch_assign ON public.user_roles;
DROP TRIGGER IF EXISTS on_user_role_created_branch_assign ON public.user_roles;
DROP FUNCTION IF EXISTS public.handle_new_branch_assignment() CASCADE;
DROP FUNCTION IF EXISTS public.handle_branch_user_assignment() CASCADE;

CREATE OR REPLACE FUNCTION public.run_complete_sale_tests()
RETURNS SETOF text
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_seq1 text;
  v_seq2 text;
  v_branch uuid;
BEGIN
  RETURN NEXT plan(7);

  SELECT id INTO v_branch FROM public.branches LIMIT 1;
  IF v_branch IS NOT NULL THEN
    v_seq1 := public.next_receipt_number(v_branch);
    v_seq2 := public.next_receipt_number(v_branch);
    RETURN NEXT ok(v_seq2 > v_seq1, 'receipt sequence is monotonic');
  ELSE
    RETURN NEXT skip('no branch to test receipts');
  END IF;

  RETURN NEXT ok(NOT EXISTS (SELECT 1 FROM public.sales WHERE business_id IS NULL), 'all sales have business_id');
  RETURN NEXT ok(NOT EXISTS (SELECT 1 FROM public.products WHERE business_id IS NULL), 'all products have business_id');
  RETURN NEXT ok(NOT EXISTS (SELECT 1 FROM public.branches WHERE business_id IS NULL), 'all branches have business_id');
  RETURN NEXT has_function('public', 'is_member_of_business', ARRAY['uuid']);
  RETURN NEXT has_function('public', 'has_role', ARRAY['uuid','app_role']);
  RETURN NEXT ok(
    NOT EXISTS (
      SELECT 1 FROM public.business_users bu
      WHERE bu.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = bu.business_id)
    ),
    'no orphan business_users rows'
  );
END;
$fn$;
