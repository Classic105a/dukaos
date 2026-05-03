
-- DR backups bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dr-backups', 'dr-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Only owners/admins can read backup files
DROP POLICY IF EXISTS "Owners and admins read dr-backups" ON storage.objects;
CREATE POLICY "Owners and admins read dr-backups"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dr-backups'
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- Service role / edge function writes; no public write policies needed.

-- Backup run history
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  kind text NOT NULL DEFAULT 'on_demand',          -- 'scheduled' | 'on_demand'
  status text NOT NULL DEFAULT 'running',          -- 'running' | 'success' | 'failed'
  file_path text,
  size_bytes bigint,
  tables_count integer,
  rows_count bigint,
  error text,
  triggered_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers view backup runs in their business" ON public.backup_runs;
CREATE POLICY "Managers view backup runs in their business"
ON public.backup_runs FOR SELECT
USING (
  ((business_id IS NULL) OR public.is_member_of_business(business_id))
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role))
);

-- Inserts/updates only via service role from edge function (no policies for anon/authenticated)

CREATE INDEX IF NOT EXISTS idx_backup_runs_business_started
  ON public.backup_runs (business_id, started_at DESC);
