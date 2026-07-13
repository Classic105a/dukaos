
-- ── M1: drop unused legacy trigger function ────────────────────────────
DROP FUNCTION IF EXISTS public.handle_new_user_role() CASCADE;

-- ── M2: has_role reads BOTH legacy user_roles AND new business_users ──
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id
      AND status = 'active'
      AND role::text = _role::text
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- ── H8: missing grants on internal tables ─────────────────────────────
-- error_logs: authenticated inserts own crash reports; service_role manages
GRANT INSERT ON public.error_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs TO service_role;

-- perf_metrics: authenticated inserts metrics; service_role reads
GRANT INSERT ON public.perf_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perf_metrics TO service_role;

-- mpesa_callbacks: only service_role (edge function) touches this
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mpesa_callbacks TO service_role;

-- promo_redemptions: authenticated reads its business; server writes
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_redemptions TO service_role;

-- receipt_sequences: only server-side function needs it
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_sequences TO service_role;

-- sync_conflicts: authenticated inserts + reads own; server reconciles
GRANT SELECT, INSERT ON public.sync_conflicts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_conflicts TO service_role;
