-- ============================================================
-- DukaOS production hardening: money / inventory / refunds / auth
-- ============================================================

-- 1. Stock ledger: allow PURCHASE (GRN) movements that the app already emits
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY['ADD','SALE','ADJUSTMENT','RETURN','TRANSFER_IN','TRANSFER_OUT','INITIAL','PURCHASE']));

-- 2. Receipt numbers must be unique per branch (DB-enforced)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_branch_receipt ON public.sales (branch_id, receipt_number);

-- 3. An M-Pesa confirmation code can only settle one completed payment
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_mpesa_reference
  ON public.payments (mpesa_reference)
  WHERE payment_method = 'mpesa' AND mpesa_reference IS NOT NULL AND status = 'completed';

-- 4. Returns: idempotency + approval linkage + line items
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS approval_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_returns_idempotency ON public.returns (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_returns_original_sale ON public.returns (original_sale_id);

CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES public.sale_items(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view return items in their business" ON public.return_items;
CREATE POLICY "Members view return items in their business" ON public.return_items
  FOR SELECT TO authenticated USING (public.is_member_of_business(business_id));
CREATE INDEX IF NOT EXISTS idx_return_items_return ON public.return_items (return_id);

-- 5. Business stamping so managers can see conflicts/returns
DROP TRIGGER IF EXISTS trg_stamp_biz_sync_conflicts ON public.sync_conflicts;
CREATE TRIGGER trg_stamp_biz_sync_conflicts BEFORE INSERT ON public.sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();
DROP TRIGGER IF EXISTS trg_stamp_biz_returns ON public.returns;
CREATE TRIGGER trg_stamp_biz_returns BEFORE INSERT ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();

-- 6. Approval requests: single-use consumption state
ALTER TABLE public.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_status_check;
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_requests_status_check
  CHECK (status = ANY (ARRAY['pending','approved','rejected','expired','consumed']));

-- 7. Business-scoped manager PIN verification (service_role only)
DROP FUNCTION IF EXISTS public.verify_manager_pin(text);
CREATE OR REPLACE FUNCTION public.verify_manager_pin(p_pin text, p_business_id uuid DEFAULT NULL)
 RETURNS TABLE(user_id uuid, full_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF p_pin IS NULL OR length(p_pin) < 4 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, bu.role::text
  FROM public.profiles p
  JOIN public.business_users bu
    ON bu.user_id = p.id AND bu.status = 'active'
   AND bu.role IN ('owner','admin','manager')
   AND (p_business_id IS NULL OR bu.business_id = p_business_id)
  WHERE p.pin_hash IS NOT NULL
    AND p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
  LIMIT 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.verify_manager_pin(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manager_pin(text, uuid) TO service_role;

-- 8. Tighten execution privileges on maintenance/definer helpers
REVOKE EXECUTE ON FUNCTION public.refresh_daily_sales_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_audit_chain(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_sale(uuid,uuid,text,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,jsonb,jsonb,text,uuid) FROM PUBLIC, anon;

-- 9. Stock ledger is append-only; refunds only via process_return
DROP POLICY IF EXISTS "Managers and above can manage stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Cashiers can record RETURN stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Cashiers can record SALE stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Members create returns in their branch" ON public.returns;

-- 10. Hardened complete_sale
CREATE OR REPLACE FUNCTION public.complete_sale(p_branch_id uuid, p_cashier_id uuid, p_receipt_number text, p_customer_id uuid DEFAULT NULL::uuid, p_shift_id uuid DEFAULT NULL::uuid, p_subtotal numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0, p_discount_amount numeric DEFAULT 0, p_total_amount numeric DEFAULT 0, p_cost_total numeric DEFAULT 0, p_profit_total numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_items jsonb DEFAULT '[]'::jsonb, p_payments jsonb DEFAULT '[]'::jsonb, p_offline_id text DEFAULT NULL::text, p_promotion_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id uuid;
  v_existing record;
  v_actual_cashier uuid;
  v_business_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_qty integer;
  v_pay_amount numeric(12,2);
  v_calc_subtotal numeric(12,2) := 0;
  v_calc_cost numeric(12,2) := 0;
  v_calc_total numeric(12,2) := 0;
  v_calc_profit numeric(12,2) := 0;
  v_calc_tax numeric(12,2) := 0;
  v_discount numeric(12,2);
  v_item_total numeric(12,2);
  v_item_tax numeric(12,2);
  v_item_taxable numeric(12,2);
  v_item_cost_total numeric(12,2);
  v_payment_total numeric(12,2) := 0;
  v_non_cash_total numeric(12,2) := 0;
  v_cash_total numeric(12,2) := 0;
  v_change numeric(12,2) := 0;
  v_server_price numeric(12,2);
  v_server_cost numeric(12,2);
  v_product_name text;
  v_product_track boolean;
  v_sorted_product_ids uuid[];
  v_pid uuid;
  v_requested integer;
  v_rows_affected integer;
  v_stock_before integer;
  v_vat_rate numeric(5,2);
  v_vat_divisor numeric(12,6);
  v_discount_ratio numeric(12,6);
  v_receipt_number text;
  v_promo record;
  v_promo_qty integer := 0;
  v_promo_eligible_subtotal numeric(12,2) := 0;
  v_promo_discount numeric(12,2) := 0;
  v_shift record;
BEGIN
  v_actual_cashier := auth.uid();
  IF v_actual_cashier IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Idempotency: same logical transaction => same result, no side effects
  IF p_offline_id IS NOT NULL AND p_offline_id <> '' THEN
    SELECT id, receipt_number, business_id, total_amount, tax_amount, discount_amount
      INTO v_existing FROM public.sales WHERE offline_id = p_offline_id;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'sale_id', v_existing.id, 'status', 'already_synced',
        'receipt_number', v_existing.receipt_number, 'business_id', v_existing.business_id,
        'server_total', v_existing.total_amount, 'server_discount', v_existing.discount_amount,
        'tax_extracted', v_existing.tax_amount);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_id = p_branch_id AND user_id = v_actual_cashier
  ) THEN
    RAISE EXCEPTION 'Cashier not assigned to this branch';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create sale with no items';
  END IF;
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Cannot create sale with no payments';
  END IF;

  SELECT business_id, COALESCE(default_tax_rate, 16.00)
  INTO v_business_id, v_vat_rate
  FROM public.branches WHERE id = p_branch_id AND COALESCE(is_active, true) = true;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Branch not found, inactive, or has no business assigned';
  END IF;

  IF NOT public.is_member_of_business(v_business_id) THEN
    RAISE EXCEPTION 'Cashier not a member of this business';
  END IF;

  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers WHERE id = p_customer_id AND business_id = v_business_id
  ) THEN
    RAISE EXCEPTION 'Customer not found in this business';
  END IF;

  IF p_shift_id IS NOT NULL THEN
    SELECT id, branch_id, status INTO v_shift FROM public.cashier_shifts WHERE id = p_shift_id;
    IF v_shift.id IS NULL OR v_shift.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'Shift not found for this branch';
    END IF;
    IF v_shift.status = 'closed' THEN
      RAISE EXCEPTION 'Shift is closed (Z-Report issued); open a new shift';
    END IF;
  END IF;

  v_vat_rate := COALESCE(v_vat_rate, 16.00);
  v_vat_divisor := 1 + (v_vat_rate / 100);

  -- Server-side pricing (ignore client values); products must belong to this business
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item->>'product_id';
    END;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be a positive whole number';
    END IF;

    v_product_name := NULL;
    SELECT unit_price, COALESCE(cost_price, 0), name, COALESCE(track_inventory, true)
    INTO v_server_price, v_server_cost, v_product_name, v_product_track
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
      AND business_id = v_business_id
      AND is_active = true;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
    END IF;

    v_item_total := ROUND(v_qty * v_server_price, 2);
    v_item_cost_total := ROUND(v_qty * v_server_cost, 2);
    v_calc_subtotal := v_calc_subtotal + v_item_total;
    v_calc_cost := v_calc_cost + v_item_cost_total;
  END LOOP;

  -- Promotion enforcement (server is sole authority)
  IF p_promotion_id IS NOT NULL THEN
    SELECT * INTO v_promo
    FROM public.promotions
    WHERE id = p_promotion_id AND business_id = v_business_id
    FOR UPDATE;

    IF v_promo.id IS NULL THEN RAISE EXCEPTION 'Promotion not found or not in this business'; END IF;
    IF NOT v_promo.is_active THEN RAISE EXCEPTION 'Promotion is not active'; END IF;
    IF v_promo.start_date IS NOT NULL AND v_promo.start_date > now() THEN RAISE EXCEPTION 'Promotion has not started'; END IF;
    IF v_promo.end_date IS NOT NULL AND v_promo.end_date < now() THEN RAISE EXCEPTION 'Promotion has expired'; END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN RAISE EXCEPTION 'Promotion redemption limit reached'; END IF;

    IF v_promo.applies_to = 'all' THEN
      v_promo_eligible_subtotal := v_calc_subtotal;
      SELECT COALESCE(SUM((elem->>'quantity')::integer), 0) INTO v_promo_qty
      FROM jsonb_array_elements(p_items) AS elem;
    ELSIF v_promo.applies_to = 'products' THEN
      SELECT COALESCE(SUM((e->>'quantity')::integer * p.unit_price), 0), COALESCE(SUM((e->>'quantity')::integer), 0)
      INTO v_promo_eligible_subtotal, v_promo_qty
      FROM jsonb_array_elements(p_items) e
      JOIN public.products p ON p.id = (e->>'product_id')::uuid
      WHERE p.id = ANY(COALESCE(v_promo.product_ids, ARRAY[]::uuid[]));
    ELSIF v_promo.applies_to = 'categories' THEN
      SELECT COALESCE(SUM((e->>'quantity')::integer * p.unit_price), 0), COALESCE(SUM((e->>'quantity')::integer), 0)
      INTO v_promo_eligible_subtotal, v_promo_qty
      FROM jsonb_array_elements(p_items) e
      JOIN public.products p ON p.id = (e->>'product_id')::uuid
      WHERE p.category_id = ANY(COALESCE(v_promo.category_ids, ARRAY[]::uuid[]));
    END IF;

    IF v_promo.min_purchase_amount IS NOT NULL AND v_calc_subtotal < v_promo.min_purchase_amount THEN
      RAISE EXCEPTION 'Cart below minimum purchase amount for promotion';
    END IF;
    IF v_promo.min_quantity IS NOT NULL AND v_promo_qty < v_promo.min_quantity THEN
      RAISE EXCEPTION 'Cart below minimum quantity for promotion';
    END IF;
    IF v_promo_eligible_subtotal <= 0 THEN
      RAISE EXCEPTION 'No eligible items for this promotion';
    END IF;

    IF v_promo.promotion_type = 'percentage_discount' THEN
      v_promo_discount := ROUND(v_promo_eligible_subtotal * (v_promo.discount_value / 100.0), 2);
    ELSIF v_promo.promotion_type = 'fixed_discount' THEN
      v_promo_discount := LEAST(ROUND(v_promo.discount_value, 2), v_promo_eligible_subtotal);
    ELSIF v_promo.promotion_type = 'bogo' THEN
      v_promo_discount := ROUND(v_promo_eligible_subtotal / 2.0, 2);
    ELSE
      v_promo_discount := ROUND(v_promo.discount_value, 2);
    END IF;

    v_discount := LEAST(v_promo_discount, v_calc_subtotal);

    UPDATE public.promotions
    SET current_uses = current_uses + 1, updated_at = now()
    WHERE id = p_promotion_id;
  ELSE
    v_discount := GREATEST(COALESCE(p_discount_amount, 0), 0);
    IF v_discount > v_calc_subtotal THEN v_discount := v_calc_subtotal; END IF;
  END IF;

  v_calc_total := v_calc_subtotal - v_discount;
  v_calc_tax := ROUND(v_calc_total - (v_calc_total / v_vat_divisor), 2);
  v_calc_profit := v_calc_total - v_calc_cost;
  v_discount_ratio := CASE WHEN v_calc_subtotal > 0
    THEN (v_calc_total::numeric / v_calc_subtotal::numeric) ELSE 1 END;

  -- Payment validation (method-aware)
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_payment->>'payment_method') NOT IN ('cash','mpesa','card','credit') THEN
      RAISE EXCEPTION 'Unsupported payment method: %', v_payment->>'payment_method';
    END IF;
    BEGIN
      v_pay_amount := ROUND((v_payment->>'amount')::numeric, 2);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid payment amount';
    END;
    IF v_pay_amount IS NULL OR v_pay_amount < 0 THEN
      RAISE EXCEPTION 'Payment amount must be zero or positive';
    END IF;
    IF (v_payment->>'payment_method') = 'mpesa'
       AND COALESCE(NULLIF(trim(v_payment->>'mpesa_reference'), ''), '') = '' THEN
      RAISE EXCEPTION 'M-Pesa payments require a confirmation code';
    END IF;
    v_payment_total := v_payment_total + v_pay_amount;
    IF (v_payment->>'payment_method') = 'cash' THEN
      v_cash_total := v_cash_total + v_pay_amount;
    ELSE
      v_non_cash_total := v_non_cash_total + v_pay_amount;
    END IF;
  END LOOP;

  IF v_non_cash_total > 0 AND v_cash_total = 0 THEN
    IF ABS(v_payment_total - v_calc_total) > 1 THEN
      RAISE EXCEPTION 'Payment mismatch: paid=% required=% (strict for card/mpesa)', v_payment_total, v_calc_total;
    END IF;
  ELSE
    IF v_payment_total < v_calc_total - 1 THEN
      RAISE EXCEPTION 'Underpayment: paid=% required=%', v_payment_total, v_calc_total;
    END IF;
  END IF;

  v_change := GREATEST(v_payment_total - v_calc_total, 0);

  -- Stock locking + atomic deduction (deterministic lock order prevents deadlocks)
  SELECT array_agg(pid ORDER BY pid) INTO v_sorted_product_ids
  FROM (SELECT DISTINCT (elem->>'product_id')::uuid AS pid FROM jsonb_array_elements(p_items) AS elem) sub;

  FOREACH v_pid IN ARRAY v_sorted_product_ids
  LOOP
    SELECT COALESCE(track_inventory, true) INTO v_product_track FROM public.products WHERE id = v_pid;
    IF v_product_track THEN
      SELECT quantity INTO v_stock_before FROM public.current_stock
      WHERE product_id = v_pid AND branch_id = p_branch_id FOR UPDATE;
      IF v_stock_before IS NULL THEN v_stock_before := 0; END IF;

      SELECT COALESCE(SUM((elem->>'quantity')::integer), 0) INTO v_requested
      FROM jsonb_array_elements(p_items) AS elem
      WHERE (elem->>'product_id')::uuid = v_pid;

      UPDATE public.current_stock
      SET quantity = quantity - v_requested, last_movement_at = now()
      WHERE product_id = v_pid AND branch_id = p_branch_id AND quantity >= v_requested;

      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected = 0 THEN
        SELECT name INTO v_product_name FROM public.products WHERE id = v_pid;
        RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
          v_product_name, v_stock_before, v_requested;
      END IF;
    END IF;
  END LOOP;

  IF p_receipt_number IS NULL OR p_receipt_number = '' THEN
    v_receipt_number := public.next_receipt_number(p_branch_id);
  ELSE
    v_receipt_number := p_receipt_number;
  END IF;

  INSERT INTO public.sales (
    branch_id, business_id, cashier_id, customer_id, receipt_number,
    subtotal, tax_amount, discount_amount, total_amount,
    cost_total, profit_total, shift_id, notes, offline_id,
    payment_status, is_synced
  ) VALUES (
    p_branch_id, v_business_id, v_actual_cashier, p_customer_id, v_receipt_number,
    v_calc_subtotal, v_calc_tax, v_discount, v_calc_total,
    v_calc_cost, v_calc_profit, p_shift_id, p_notes, NULLIF(p_offline_id, ''),
    'completed', true
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT unit_price, COALESCE(cost_price, 0), name
    INTO v_server_price, v_server_cost, v_product_name
    FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    v_item_total := ROUND((v_item->>'quantity')::integer * v_server_price, 2);
    v_item_taxable := ROUND(v_item_total * v_discount_ratio, 2);
    v_item_tax := ROUND(v_item_taxable - (v_item_taxable / v_vat_divisor), 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, product_name, quantity,
      unit_price, discount_amount, tax_amount, total_amount
    ) VALUES (
      v_sale_id, (v_item->>'product_id')::uuid, v_product_name,
      (v_item->>'quantity')::integer, v_server_price,
      ROUND(v_item_total - v_item_taxable, 2), v_item_tax, v_item_total
    );

    INSERT INTO public.stock_movements (
      product_id, branch_id, business_id, quantity_change,
      movement_type, reference_id, created_by, notes
    ) VALUES (
      (v_item->>'product_id')::uuid, p_branch_id, v_business_id,
      -(v_item->>'quantity')::integer, 'SALE', v_sale_id, v_actual_cashier,
      'Sale ' || v_receipt_number
    );
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO public.payments (
      sale_id, payment_method, amount, mpesa_reference, mpesa_phone, status
    ) VALUES (
      v_sale_id, v_payment->>'payment_method', ROUND((v_payment->>'amount')::numeric, 2),
      NULLIF(trim(v_payment->>'mpesa_reference'), ''), NULLIF(trim(v_payment->>'mpesa_phone'), ''), 'completed'
    );
  END LOOP;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_purchases = COALESCE(total_purchases, 0) + v_calc_total,
        visit_count = COALESCE(visit_count, 0) + 1, updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  IF p_promotion_id IS NOT NULL THEN
    INSERT INTO public.promo_redemptions (
      promotion_id, business_id, branch_id, sale_id, customer_id,
      cashier_id, cart_subtotal, discount_applied, promo_snapshot
    ) VALUES (
      p_promotion_id, v_business_id, p_branch_id, v_sale_id, p_customer_id,
      v_actual_cashier, v_calc_subtotal, v_discount,
      jsonb_build_object(
        'name', v_promo.name, 'type', v_promo.promotion_type,
        'value', v_promo.discount_value, 'applies_to', v_promo.applies_to,
        'eligible_subtotal', v_promo_eligible_subtotal
      )
    );
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, branch_id, business_id, new_values)
  VALUES (
    v_actual_cashier, 'SALE_COMPLETED', 'sale', v_sale_id, p_branch_id, v_business_id,
    jsonb_build_object(
      'receipt_number', v_receipt_number, 'subtotal', v_calc_subtotal,
      'discount', v_discount, 'taxable_base', v_calc_total,
      'tax_extracted', v_calc_tax, 'total', v_calc_total,
      'cost', v_calc_cost, 'profit', v_calc_profit,
      'items_count', jsonb_array_length(p_items),
      'payment_total', v_payment_total, 'cash_tendered', v_cash_total,
      'non_cash_total', v_non_cash_total, 'change', v_change,
      'vat_rate', v_vat_rate, 'business_id', v_business_id,
      'offline_id', p_offline_id, 'promotion_id', p_promotion_id
    )
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id, 'status', 'completed',
    'receipt_number', v_receipt_number, 'business_id', v_business_id,
    'server_total', v_calc_total, 'server_discount', v_discount,
    'tax_extracted', v_calc_tax, 'vat_rate', v_vat_rate, 'change', v_change,
    'promotion_id', p_promotion_id
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent duplicate of the same offline transaction: return the winner.
    IF p_offline_id IS NOT NULL AND p_offline_id <> '' THEN
      SELECT id, receipt_number INTO v_existing FROM public.sales WHERE offline_id = p_offline_id;
      IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object('sale_id', v_existing.id, 'status', 'already_synced', 'receipt_number', v_existing.receipt_number);
      END IF;
    END IF;
    IF SQLERRM LIKE '%uq_payments_mpesa_reference%' THEN
      RAISE EXCEPTION 'This M-Pesa code has already been used on another sale';
    END IF;
    IF SQLERRM LIKE '%uq_sales_branch_receipt%' THEN
      RAISE EXCEPTION 'Receipt number % already exists for this branch', p_receipt_number;
    END IF;
    RAISE;
END;
$function$;

-- 11. Atomic, authorized, idempotent refunds
CREATE OR REPLACE FUNCTION public.process_return(
  p_sale_id uuid,
  p_items jsonb,
  p_reason text,
  p_refund_method text DEFAULT 'cash',
  p_idempotency_key text DEFAULT NULL,
  p_approval_request_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sale record;
  v_existing record;
  v_is_manager boolean;
  v_approval record;
  v_approved_by uuid;
  v_item jsonb;
  v_si record;
  v_qty integer;
  v_ratio numeric(12,6);
  v_line_refund numeric(12,2);
  v_total_refund numeric(12,2) := 0;
  v_prev_refunded numeric(12,2) := 0;
  v_return_id uuid;
  v_sold integer;
  v_already integer;
  v_requested integer;
  v_pid uuid;
  v_items_out jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Select at least one item to return';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_refund_method NOT IN ('cash','mpesa','store_credit','card') THEN
    RAISE EXCEPTION 'Unsupported refund method: %', p_refund_method;
  END IF;

  -- Idempotent replay
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT id, refund_amount INTO v_existing FROM public.returns WHERE idempotency_key = p_idempotency_key;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('return_id', v_existing.id, 'refund_amount', v_existing.refund_amount, 'status', 'already_processed');
    END IF;
  END IF;

  SELECT id, branch_id, business_id, receipt_number, subtotal, total_amount, payment_status
    INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF NOT public.is_member_of_business(v_sale.business_id) THEN RAISE EXCEPTION 'Not a member of this business'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branch_users WHERE branch_id = v_sale.branch_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'You are not assigned to the branch of this sale';
  END IF;
  IF v_sale.payment_status = 'refunded' THEN RAISE EXCEPTION 'This sale has already been fully refunded'; END IF;

  -- Authorization: manager+ directly, or cashier with a fresh single-use manager approval
  v_is_manager := public.has_business_role(v_uid, v_sale.business_id, ARRAY['owner','admin','manager']);
  IF v_is_manager THEN
    v_approved_by := v_uid;
  ELSE
    IF p_approval_request_id IS NULL THEN
      RAISE EXCEPTION 'Manager approval required to process refunds';
    END IF;
    SELECT * INTO v_approval FROM public.approval_requests WHERE id = p_approval_request_id FOR UPDATE;
    IF v_approval.id IS NULL
       OR v_approval.status <> 'approved'
       OR v_approval.request_type <> 'REFUND'
       OR v_approval.requested_by <> v_uid
       OR v_approval.branch_id IS DISTINCT FROM v_sale.branch_id
       OR (v_approval.entity_id IS NOT NULL AND v_approval.entity_id <> p_sale_id)
       OR v_approval.approved_by IS NULL
       OR COALESCE(v_approval.resolved_at, v_approval.created_at) < now() - interval '15 minutes'
       OR NOT public.has_business_role(v_approval.approved_by, v_sale.business_id, ARRAY['owner','admin','manager'])
    THEN
      RAISE EXCEPTION 'Manager approval is missing, expired, or invalid';
    END IF;
    v_approved_by := v_approval.approved_by;
    UPDATE public.approval_requests SET status = 'consumed', entity_id = p_sale_id, resolved_at = now()
      WHERE id = v_approval.id;
  END IF;

  v_ratio := CASE WHEN COALESCE(v_sale.subtotal, 0) > 0
    THEN (v_sale.total_amount::numeric / v_sale.subtotal::numeric) ELSE 1 END;

  SELECT COALESCE(SUM(refund_amount), 0) INTO v_prev_refunded
    FROM public.returns WHERE original_sale_id = p_sale_id AND status = 'completed';

  INSERT INTO public.returns (original_sale_id, branch_id, business_id, processed_by, reason,
                              refund_method, refund_amount, status, idempotency_key, approved_by, approval_request_id)
  VALUES (p_sale_id, v_sale.branch_id, v_sale.business_id, v_uid, trim(p_reason),
          p_refund_method, 0, 'completed', NULLIF(p_idempotency_key, ''), v_approved_by, p_approval_request_id)
  RETURNING id INTO v_return_id;

  -- Per-product over-refund guard: sold - already returned (ledger) >= requested
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN v_qty := (v_item->>'quantity')::integer; EXCEPTION WHEN others THEN v_qty := NULL; END;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Return quantity must be a positive whole number'; END IF;

    SELECT id, product_id, product_name, quantity, unit_price
      INTO v_si FROM public.sale_items
      WHERE id = (v_item->>'sale_item_id')::uuid AND sale_id = p_sale_id;
    IF v_si.id IS NULL THEN RAISE EXCEPTION 'Item does not belong to this sale'; END IF;

    v_line_refund := ROUND(v_qty * v_si.unit_price * v_ratio, 2);
    v_total_refund := v_total_refund + v_line_refund;

    INSERT INTO public.return_items (return_id, sale_item_id, product_id, product_name, quantity, unit_price, refund_amount, business_id)
    VALUES (v_return_id, v_si.id, v_si.product_id, v_si.product_name, v_qty, v_si.unit_price, v_line_refund, v_sale.business_id);

    INSERT INTO public.stock_movements (product_id, branch_id, business_id, quantity_change, movement_type, reference_id, created_by, notes)
    VALUES (v_si.product_id, v_sale.branch_id, v_sale.business_id, v_qty, 'RETURN', v_return_id, v_uid,
            'Return for ' || v_sale.receipt_number);

    v_items_out := v_items_out || jsonb_build_object('product_id', v_si.product_id, 'product_name', v_si.product_name, 'quantity', v_qty, 'refund', v_line_refund);
  END LOOP;

  FOR v_pid IN SELECT DISTINCT product_id FROM public.return_items WHERE return_id = v_return_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_sold FROM public.sale_items WHERE sale_id = p_sale_id AND product_id = v_pid;
    SELECT COALESCE(SUM(sm.quantity_change), 0) INTO v_already
      FROM public.stock_movements sm
      JOIN public.returns r ON r.id = sm.reference_id
      WHERE sm.movement_type = 'RETURN' AND sm.product_id = v_pid
        AND r.original_sale_id = p_sale_id AND r.status = 'completed';
    IF v_already > v_sold THEN
      RAISE EXCEPTION 'Return exceeds quantity sold for this product (sold %, returned %)', v_sold, v_already;
    END IF;
  END LOOP;

  IF v_prev_refunded + v_total_refund > v_sale.total_amount + 0.01 THEN
    RAISE EXCEPTION 'Refund exceeds the amount paid for this sale';
  END IF;

  UPDATE public.returns SET refund_amount = v_total_refund WHERE id = v_return_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, branch_id, business_id, new_values)
  VALUES (v_uid, 'REFUND_PROCESSED', 'return', v_return_id, v_sale.branch_id, v_sale.business_id,
    jsonb_build_object('original_sale_id', p_sale_id, 'receipt_number', v_sale.receipt_number,
      'refund_amount', v_total_refund, 'refund_method', p_refund_method, 'reason', trim(p_reason),
      'items', v_items_out, 'approved_by', v_approved_by, 'approval_request_id', p_approval_request_id,
      'idempotency_key', p_idempotency_key));

  RETURN jsonb_build_object('return_id', v_return_id, 'refund_amount', v_total_refund, 'status', 'completed', 'items', v_items_out);
EXCEPTION
  WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
      SELECT id, refund_amount INTO v_existing FROM public.returns WHERE idempotency_key = p_idempotency_key;
      IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object('return_id', v_existing.id, 'refund_amount', v_existing.refund_amount, 'status', 'already_processed');
      END IF;
    END IF;
    RAISE;
END;
$function$;
REVOKE ALL ON FUNCTION public.process_return(uuid, jsonb, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_return(uuid, jsonb, text, text, text, uuid) TO authenticated, service_role;

-- 12. Branch logo storage: writes scoped to the branch's own business
DROP POLICY IF EXISTS "Managers can upload branch logos" ON storage.objects;
DROP POLICY IF EXISTS "Managers can update branch logos" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete branch logos" ON storage.objects;
CREATE POLICY "Managers can upload branch logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branch-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.has_business_role(auth.uid(), public.business_id_from_branch(((storage.foldername(name))[1])::uuid), ARRAY['owner','admin','manager']));
CREATE POLICY "Managers can update branch logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branch-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.has_business_role(auth.uid(), public.business_id_from_branch(((storage.foldername(name))[1])::uuid), ARRAY['owner','admin','manager']));
CREATE POLICY "Managers can delete branch logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branch-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.has_business_role(auth.uid(), public.business_id_from_branch(((storage.foldername(name))[1])::uuid), ARRAY['owner','admin','manager']));