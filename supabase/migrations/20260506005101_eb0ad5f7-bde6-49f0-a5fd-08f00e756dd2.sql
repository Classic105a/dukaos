
-- Helper RPC: mark expired pending invites and purge old accepted/revoked/expired ones
CREATE OR REPLACE FUNCTION public.cleanup_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired int;
  v_purged int;
BEGIN
  UPDATE public.invites
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  DELETE FROM public.invites
   WHERE status IN ('accepted','revoked','expired')
     AND COALESCE(accepted_at, created_at) < now() - interval '30 days';
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object('expired', v_expired, 'purged', v_purged);
END $$;

REVOKE ALL ON FUNCTION public.cleanup_invites() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_invites() TO service_role;

-- Schedule daily cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-invites-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-invites-daily',
  '15 2 * * *',
  $$ SELECT public.cleanup_invites(); $$
);
