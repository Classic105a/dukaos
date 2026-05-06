
-- 1. business_users hardening
ALTER TABLE public.business_users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by uuid;

-- Normalize allowed roles (kept lowercase for backward compat)
ALTER TABLE public.business_users DROP CONSTRAINT IF EXISTS business_users_role_check;
ALTER TABLE public.business_users
  ADD CONSTRAINT business_users_role_check
  CHECK (role IN ('owner','admin','manager','attendant','cashier','staff'));

ALTER TABLE public.business_users DROP CONSTRAINT IF EXISTS business_users_status_check;
ALTER TABLE public.business_users
  ADD CONSTRAINT business_users_status_check
  CHECK (status IN ('pending','active'));

CREATE UNIQUE INDEX IF NOT EXISTS business_users_unique_member
  ON public.business_users(business_id, user_id);

-- 2. Invites table
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'attendant'
    CHECK (role IN ('owner','admin','manager','attendant','cashier')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invites_business_idx ON public.invites(business_id);
CREATE INDEX IF NOT EXISTS invites_email_idx ON public.invites(lower(email));

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins manage invites" ON public.invites;
CREATE POLICY "Owners and admins manage invites"
  ON public.invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_users bu
      WHERE bu.business_id = invites.business_id
        AND bu.user_id = auth.uid()
        AND (bu.is_owner = true OR bu.role IN ('owner','admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_users bu
      WHERE bu.business_id = invites.business_id
        AND bu.user_id = auth.uid()
        AND (bu.is_owner = true OR bu.role IN ('owner','admin'))
    )
  );

-- 3. Server-side invite RPCs
CREATE OR REPLACE FUNCTION public.create_invite(
  p_business_id uuid, p_email text, p_role text DEFAULT 'attendant'
) RETURNS public.invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_invite public.invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE business_id = p_business_id AND user_id = auth.uid()
      AND (is_owner = true OR role IN ('owner','admin'))
  ) THEN
    RAISE EXCEPTION 'Only owners and admins can invite';
  END IF;
  IF p_role NOT IN ('admin','manager','attendant','cashier') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO public.invites (business_id, email, role, invited_by)
  VALUES (p_business_id, lower(trim(p_email)), p_role, auth.uid())
  RETURNING * INTO v_invite;

  RETURN v_invite;
END $$;

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.invites;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in to accept an invite'; END IF;

  SELECT * INTO v_invite FROM public.invites
   WHERE token = p_token AND status = 'pending' AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invite is invalid or expired'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(v_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'This invite was sent to %, not %', v_invite.email, v_email;
  END IF;

  INSERT INTO public.business_users (business_id, user_id, role, is_owner, status, invited_by)
  VALUES (v_invite.business_id, auth.uid(), v_invite.role, false, 'active', v_invite.invited_by)
  ON CONFLICT (business_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active';

  UPDATE public.invites
     SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('business_id', v_invite.business_id, 'role', v_invite.role);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_invite(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_biz uuid;
BEGIN
  SELECT business_id INTO v_biz FROM public.invites WHERE id = p_invite_id;
  IF v_biz IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE business_id = v_biz AND user_id = auth.uid()
      AND (is_owner = true OR role IN ('owner','admin'))
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.invites SET status = 'revoked' WHERE id = p_invite_id;
END $$;

-- 4. Auto-create business on signup unless invite is pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- Skip business creation if user is being invited
  IF v_has_invite THEN RETURN NEW; END IF;

  -- Create a default business and own it
  INSERT INTO public.businesses (name, type, created_by)
  VALUES (COALESCE(v_full_name,'My Business') || '''s Business', 'retail', NEW.id)
  RETURNING id INTO v_biz_id;

  INSERT INTO public.business_users (business_id, user_id, role, is_owner, status)
  VALUES (v_biz_id, NEW.id, 'owner', true, 'active');

  -- Legacy compat: also keep user_roles in sync as owner
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill: ensure every existing user has at least one business + owner row
DO $$
DECLARE r record; v_biz uuid;
BEGIN
  FOR r IN
    SELECT u.id, u.email, COALESCE(p.full_name, split_part(u.email,'@',1)) AS full_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE NOT EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.user_id = u.id)
  LOOP
    INSERT INTO public.businesses (name, type, created_by)
    VALUES (COALESCE(r.full_name,'My Business') || '''s Business', 'retail', r.id)
    RETURNING id INTO v_biz;

    INSERT INTO public.business_users (business_id, user_id, role, is_owner, status)
    VALUES (v_biz, r.id, 'owner', true, 'active');
  END LOOP;
END $$;
