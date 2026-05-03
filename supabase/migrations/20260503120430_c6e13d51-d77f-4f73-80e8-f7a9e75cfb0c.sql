-- ─── #5 Offline oversell ────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allow_negative_stock boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  branch_id uuid,
  cashier_id uuid NOT NULL,
  offline_id text NOT NULL,
  conflict_type text NOT NULL,           -- 'oversell' | 'duplicate' | 'validation' | 'other'
  error_message text,
  payload jsonb NOT NULL,                -- the original sale payload
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'discarded'
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON public.sync_conflicts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_business ON public.sync_conflicts(business_id);

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can insert sync conflicts"
  ON public.sync_conflicts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND cashier_id = auth.uid()
              AND (business_id IS NULL OR public.is_member_of_business(business_id)));

CREATE POLICY "Members view sync conflicts in their business"
  ON public.sync_conflicts FOR SELECT
  USING (business_id IS NULL OR public.is_member_of_business(business_id));

CREATE POLICY "Managers resolve sync conflicts"
  ON public.sync_conflicts FOR UPDATE
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ─── #8 Z-Report shift locking ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_edits_on_closed_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id uuid;
  v_status text;
BEGIN
  IF TG_TABLE_NAME = 'sales' THEN
    v_shift_id := COALESCE(NEW.shift_id, OLD.shift_id);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    SELECT s.shift_id INTO v_shift_id FROM public.sales s
      WHERE s.id = COALESCE(NEW.sale_id, OLD.sale_id);
  END IF;

  IF v_shift_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT status INTO v_status FROM public.cashier_shifts WHERE id = v_shift_id;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'Shift % is closed (Z-Report issued). Edits and deletes are not allowed.', v_shift_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_sales_on_closed_shift ON public.sales;
CREATE TRIGGER trg_lock_sales_on_closed_shift
  BEFORE UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.block_edits_on_closed_shift();

DROP TRIGGER IF EXISTS trg_lock_payments_on_closed_shift ON public.payments;
CREATE TRIGGER trg_lock_payments_on_closed_shift
  BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.block_edits_on_closed_shift();

-- ─── #9 Audit log tamper protection (hash chain) ────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS row_hash  text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

CREATE OR REPLACE FUNCTION public.audit_logs_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev text;
  v_payload text;
BEGIN
  SELECT row_hash INTO v_prev
    FROM public.audit_logs
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

  NEW.prev_hash := v_prev;

  v_payload := COALESCE(v_prev,'') || '|'
            || COALESCE(NEW.id::text,'') || '|'
            || COALESCE(NEW.user_id::text,'') || '|'
            || COALESCE(NEW.action,'') || '|'
            || COALESCE(NEW.entity_type,'') || '|'
            || COALESCE(NEW.entity_id::text,'') || '|'
            || COALESCE(NEW.business_id::text,'') || '|'
            || COALESCE(NEW.branch_id::text,'') || '|'
            || COALESCE(NEW.old_values::text,'') || '|'
            || COALESCE(NEW.new_values::text,'') || '|'
            || COALESCE(NEW.created_at::text, now()::text);

  NEW.row_hash := encode(extensions.digest(v_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_hash_chain ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_hash_chain
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_hash_chain();

-- Verifier RPC
CREATE OR REPLACE FUNCTION public.verify_audit_chain(p_limit int DEFAULT 1000)
RETURNS TABLE(broken_at_id uuid, broken_at_created_at timestamptz, expected_prev text, actual_prev text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_prev text := NULL;
BEGIN
  FOR r IN
    SELECT id, created_at, prev_hash, row_hash
    FROM public.audit_logs
    ORDER BY created_at ASC, id ASC
    LIMIT p_limit
  LOOP
    IF v_prev IS NOT NULL AND r.prev_hash IS DISTINCT FROM v_prev THEN
      broken_at_id := r.id;
      broken_at_created_at := r.created_at;
      expected_prev := v_prev;
      actual_prev := r.prev_hash;
      RETURN NEXT;
      RETURN;
    END IF;
    v_prev := r.row_hash;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_audit_chain(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(int) TO authenticated;

-- ─── #7 M-Pesa callback scaffold ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mpesa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  branch_id uuid,
  sale_id uuid,
  payment_id uuid,
  merchant_request_id text,
  checkout_request_id text,
  result_code int,
  result_desc text,
  amount numeric(12,2),
  mpesa_receipt_number text,
  phone_number text,
  transaction_date timestamptz,
  raw_payload jsonb NOT NULL,
  reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_callbacks_checkout ON public.mpesa_callbacks(checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_callbacks_receipt  ON public.mpesa_callbacks(mpesa_receipt_number) WHERE mpesa_receipt_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mpesa_callbacks_business ON public.mpesa_callbacks(business_id, created_at DESC);

ALTER TABLE public.mpesa_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view mpesa callbacks in their business"
  ON public.mpesa_callbacks FOR SELECT
  USING ((business_id IS NULL OR public.is_member_of_business(business_id))
         AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
-- INSERT/UPDATE happen via SECURITY DEFINER edge function (service role); no RLS policies for mutation = denied for anon/authenticated.