
-- ============================================================
-- 1. Convert current_stock from VIEW to TABLE
-- ============================================================
DROP VIEW IF EXISTS public.current_stock;

CREATE TABLE public.current_stock (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  last_movement_at timestamptz DEFAULT now(),
  latest_expiry_date date,
  latest_batch_number text,
  PRIMARY KEY (product_id, branch_id)
);

-- Populate from existing stock_movements
INSERT INTO public.current_stock (product_id, branch_id, quantity, last_movement_at)
SELECT
  product_id,
  branch_id,
  COALESCE(SUM(quantity_change), 0)::integer,
  MAX(created_at)
FROM public.stock_movements
GROUP BY product_id, branch_id
ON CONFLICT DO NOTHING;

-- Indexes for fast lookups
CREATE INDEX idx_current_stock_branch ON public.current_stock (branch_id);
CREATE INDEX idx_current_stock_low ON public.current_stock (branch_id, quantity) WHERE quantity > 0;

-- RLS
ALTER TABLE public.current_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view stock"
ON public.current_stock FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage stock"
ON public.current_stock FOR ALL
USING (
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- ============================================================
-- 2. Trigger: sync current_stock for NON-SALE movements
--    SALE movements are handled atomically in complete_sale
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_current_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- SALE movements are deducted atomically in complete_sale — skip trigger
  IF NEW.movement_type = 'SALE' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.current_stock (product_id, branch_id, quantity, last_movement_at,
    latest_expiry_date, latest_batch_number)
  VALUES (
    NEW.product_id, NEW.branch_id, NEW.quantity_change, NEW.created_at,
    NEW.expiry_date, NEW.batch_number
  )
  ON CONFLICT (product_id, branch_id)
  DO UPDATE SET
    quantity = current_stock.quantity + NEW.quantity_change,
    last_movement_at = GREATEST(current_stock.last_movement_at, NEW.created_at),
    latest_expiry_date = COALESCE(NEW.expiry_date, current_stock.latest_expiry_date),
    latest_batch_number = COALESCE(NEW.batch_number, current_stock.latest_batch_number);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_current_stock
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.sync_current_stock();

-- ============================================================
-- 3. Update get_product_stock to use TABLE instead of SUM
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_product_stock(p_product_id uuid, p_branch_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(quantity, 0)
  FROM public.current_stock
  WHERE product_id = p_product_id AND branch_id = p_branch_id
$$;

-- ============================================================
-- 4. Update get_low_stock_alerts to use TABLE
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(p_branch_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  FROM (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.low_stock_threshold,
      COALESCE(cs.quantity, 0) AS current_stock
    FROM public.products p
    LEFT JOIN public.current_stock cs
      ON cs.product_id = p.id AND cs.branch_id = p_branch_id
    WHERE p.is_active = true
      AND p.track_inventory = true
      AND COALESCE(cs.quantity, 0) <= COALESCE(p.low_stock_threshold, 10)
      AND (p.branch_id = p_branch_id OR p.is_shared_product = true)
    ORDER BY COALESCE(cs.quantity, 0) ASC
    LIMIT 50
  ) t
$$;

-- ============================================================
-- 5. Indexes for audit_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON public.audit_logs (branch_id, created_at DESC);

-- ============================================================
-- 6. ENTERPRISE complete_sale FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_sale(
  p_branch_id uuid,
  p_cashier_id uuid,
  p_receipt_number text,
  p_customer_id uuid DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_total_amount numeric DEFAULT 0,
  p_cost_total numeric DEFAULT 0,
  p_profit_total numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_offline_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sale_id uuid;
  v_actual_cashier uuid;
  v_item jsonb;
  v_payment jsonb;
  v_calc_subtotal numeric(12,2) := 0;
  v_calc_cost numeric(12,2) := 0;
  v_calc_total numeric(12,2) := 0;
  v_calc_profit numeric(12,2) := 0;
  v_item_total numeric(12,2);
  v_item_cost_total numeric(12,2);
  v_payment_total numeric(12,2) := 0;
  v_server_price numeric(12,2);
  v_server_cost numeric(12,2);
  v_product_name text;
  v_product_track boolean;
  v_sorted_product_ids uuid[];
  v_pid uuid;
  v_requested integer;
  v_rows_affected integer;
  v_stock_before integer;
BEGIN
  -- ======== AUTHENTICATION ========
  v_actual_cashier := auth.uid();
  IF v_actual_cashier IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify cashier assigned to branch
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_id = p_branch_id AND user_id = v_actual_cashier
  ) THEN
    RAISE EXCEPTION 'Cashier not assigned to this branch';
  END IF;

  -- Validate items
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create sale with no items';
  END IF;

  -- ======== SERVER-SIDE PRICING (never trust client) ========
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT unit_price, COALESCE(cost_price, 0), name, COALESCE(track_inventory, true)
    INTO v_server_price, v_server_cost, v_product_name, v_product_track
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND is_active = true;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
    END IF;

    v_item_total := ROUND((v_item->>'quantity')::integer * v_server_price, 2);
    v_item_cost_total := ROUND((v_item->>'quantity')::integer * v_server_cost, 2);
    v_calc_subtotal := v_calc_subtotal + v_item_total;
    v_calc_cost := v_calc_cost + v_item_cost_total;
  END LOOP;

  v_calc_total := v_calc_subtotal + COALESCE(p_tax_amount, 0) - COALESCE(p_discount_amount, 0);
  v_calc_profit := v_calc_subtotal - v_calc_cost;

  -- ======== PAYMENT VALIDATION ========
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_total := v_payment_total + ROUND((v_payment->>'amount')::numeric, 2);
  END LOOP;

  IF v_payment_total < v_calc_total - 1 THEN
    RAISE EXCEPTION 'Underpayment: paid=% required=%', v_payment_total, v_calc_total;
  END IF;

  -- ======== STOCK: LOCK + ATOMIC DEDUCTION ========
  SELECT array_agg(pid ORDER BY pid) INTO v_sorted_product_ids
  FROM (
    SELECT DISTINCT (elem->>'product_id')::uuid AS pid
    FROM jsonb_array_elements(p_items) AS elem
  ) sub;

  FOREACH v_pid IN ARRAY v_sorted_product_ids
  LOOP
    SELECT COALESCE(track_inventory, true) INTO v_product_track
    FROM public.products WHERE id = v_pid;

    IF v_product_track THEN
      -- Lock row
      SELECT quantity INTO v_stock_before
      FROM public.current_stock
      WHERE product_id = v_pid AND branch_id = p_branch_id
      FOR UPDATE;

      IF v_stock_before IS NULL THEN
        v_stock_before := 0;
      END IF;

      SELECT COALESCE(SUM((elem->>'quantity')::integer), 0) INTO v_requested
      FROM jsonb_array_elements(p_items) AS elem
      WHERE (elem->>'product_id')::uuid = v_pid;

      -- Atomic deduction: fails if insufficient
      UPDATE public.current_stock
      SET quantity = quantity - v_requested,
          last_movement_at = now()
      WHERE product_id = v_pid
        AND branch_id = p_branch_id
        AND quantity >= v_requested;

      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

      IF v_rows_affected = 0 THEN
        SELECT name INTO v_product_name FROM public.products WHERE id = v_pid;
        RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
          v_product_name, v_stock_before, v_requested;
      END IF;
    END IF;
  END LOOP;

  -- ======== INSERT SALE (server-calculated totals) ========
  INSERT INTO public.sales (
    branch_id, cashier_id, customer_id, receipt_number,
    subtotal, tax_amount, discount_amount, total_amount,
    cost_total, profit_total, shift_id, notes, offline_id,
    payment_status, is_synced
  ) VALUES (
    p_branch_id, v_actual_cashier, p_customer_id, p_receipt_number,
    v_calc_subtotal, COALESCE(p_tax_amount, 0), COALESCE(p_discount_amount, 0), v_calc_total,
    v_calc_cost, v_calc_profit, p_shift_id, p_notes, p_offline_id,
    'completed', true
  )
  RETURNING id INTO v_sale_id;

  -- ======== INSERT ITEMS + STOCK MOVEMENT AUDIT TRAIL ========
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT unit_price, COALESCE(cost_price, 0), name
    INTO v_server_price, v_server_cost, v_product_name
    FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    v_item_total := ROUND((v_item->>'quantity')::integer * v_server_price, 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, product_name, quantity,
      unit_price, discount_amount, tax_amount, total_amount
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_product_name,
      (v_item->>'quantity')::integer,
      v_server_price,
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      COALESCE((v_item->>'tax_amount')::numeric, 0),
      v_item_total
    );

    -- Audit trail in stock_movements (trigger skips SALE type)
    INSERT INTO public.stock_movements (
      product_id, branch_id, quantity_change,
      movement_type, reference_id, created_by, notes
    ) VALUES (
      (v_item->>'product_id')::uuid,
      p_branch_id,
      -(v_item->>'quantity')::integer,
      'SALE',
      v_sale_id,
      v_actual_cashier,
      'Sale ' || p_receipt_number
    );
  END LOOP;

  -- ======== INSERT PAYMENTS ========
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO public.payments (
      sale_id, payment_method, amount,
      mpesa_reference, mpesa_phone, status
    ) VALUES (
      v_sale_id,
      v_payment->>'payment_method',
      ROUND((v_payment->>'amount')::numeric, 2),
      v_payment->>'mpesa_reference',
      v_payment->>'mpesa_phone',
      'completed'
    );
  END LOOP;

  -- ======== CUSTOMER STATS ========
  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_purchases = COALESCE(total_purchases, 0) + v_calc_total,
        visit_count = COALESCE(visit_count, 0) + 1,
        updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  -- ======== AUDIT LOG (inside transaction) ========
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, branch_id, new_values)
  VALUES (
    v_actual_cashier,
    'SALE_COMPLETED',
    'sale',
    v_sale_id,
    p_branch_id,
    jsonb_build_object(
      'receipt_number', p_receipt_number,
      'subtotal', v_calc_subtotal,
      'tax', COALESCE(p_tax_amount, 0),
      'discount', COALESCE(p_discount_amount, 0),
      'total', v_calc_total,
      'cost', v_calc_cost,
      'profit', v_calc_profit,
      'items_count', jsonb_array_length(p_items),
      'payment_total', v_payment_total,
      'offline_id', p_offline_id
    )
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'status', 'completed',
    'receipt_number', p_receipt_number,
    'server_total', v_calc_total
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Idempotency: offline_id collision means already synced
    IF p_offline_id IS NOT NULL THEN
      SELECT id INTO v_sale_id FROM public.sales WHERE offline_id = p_offline_id;
      IF v_sale_id IS NOT NULL THEN
        RETURN jsonb_build_object('sale_id', v_sale_id, 'status', 'already_synced');
      END IF;
    END IF;
    RAISE;
END;
$$;
