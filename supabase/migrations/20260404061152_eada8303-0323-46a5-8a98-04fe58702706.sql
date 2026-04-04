
-- 1. Enforce idempotency at DB level
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_offline_id 
ON public.sales (offline_id) WHERE offline_id IS NOT NULL;

-- Drop the old non-unique index (now redundant)
DROP INDEX IF EXISTS idx_sales_offline_id;

-- 2. Rebuild complete_sale with all fixes
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
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_current_stock integer;
  v_product_name text;
  v_product_track boolean;
  v_actual_cashier uuid;
  v_calc_subtotal numeric(12,2) := 0;
  v_calc_total numeric(12,2) := 0;
  v_item_total numeric(12,2);
  v_payment_total numeric(12,2) := 0;
  v_sorted_product_ids uuid[];
  v_pid uuid;
  v_requested integer;
BEGIN
  -- SECURITY: Always use the authenticated user, never trust client
  v_actual_cashier := auth.uid();
  IF v_actual_cashier IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify cashier is assigned to branch
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_id = p_branch_id AND user_id = v_actual_cashier
  ) THEN
    RAISE EXCEPTION 'Cashier is not assigned to this branch';
  END IF;

  -- Validate items array is not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create a sale with no items';
  END IF;

  -- SERVER-SIDE RECALCULATION: Never trust client totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total := ROUND((v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric, 2);
    v_calc_subtotal := v_calc_subtotal + v_item_total;
  END LOOP;
  v_calc_total := v_calc_subtotal + COALESCE(p_tax_amount, 0) - COALESCE(p_discount_amount, 0);

  -- Validate payment total
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_total := v_payment_total + (v_payment->>'amount')::numeric;
  END LOOP;
  IF ABS(v_payment_total - v_calc_total) > 1 THEN
    RAISE EXCEPTION 'Payment total (%) does not match sale total (%)', v_payment_total, v_calc_total;
  END IF;

  -- DEADLOCK PREVENTION: Sort product IDs for consistent lock order
  SELECT array_agg(pid ORDER BY pid) INTO v_sorted_product_ids
  FROM (
    SELECT DISTINCT (elem->>'product_id')::uuid AS pid
    FROM jsonb_array_elements(p_items) AS elem
  ) sub;

  -- Lock and validate stock in sorted order
  FOREACH v_pid IN ARRAY v_sorted_product_ids
  LOOP
    SELECT name, COALESCE(track_inventory, true)
    INTO v_product_name, v_product_track
    FROM public.products
    WHERE id = v_pid;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Product % not found', v_pid;
    END IF;

    -- Lock stock rows
    SELECT COALESCE(SUM(quantity_change), 0) INTO v_current_stock
    FROM public.stock_movements
    WHERE product_id = v_pid AND branch_id = p_branch_id
    FOR UPDATE;

    -- Validate stock
    IF v_product_track THEN
      SELECT COALESCE(SUM((elem->>'quantity')::integer), 0) INTO v_requested
      FROM jsonb_array_elements(p_items) AS elem
      WHERE (elem->>'product_id')::uuid = v_pid;

      IF v_current_stock < v_requested THEN
        RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
          v_product_name, v_current_stock, v_requested;
      END IF;
    END IF;
  END LOOP;

  -- Insert sale with SERVER-CALCULATED totals
  INSERT INTO public.sales (
    branch_id, cashier_id, customer_id, receipt_number,
    subtotal, tax_amount, discount_amount, total_amount,
    cost_total, profit_total, shift_id, notes, offline_id,
    payment_status, is_synced
  ) VALUES (
    p_branch_id, v_actual_cashier, p_customer_id, p_receipt_number,
    v_calc_subtotal, COALESCE(p_tax_amount, 0), COALESCE(p_discount_amount, 0), v_calc_total,
    COALESCE(p_cost_total, 0), COALESCE(p_profit_total, 0), p_shift_id, p_notes, p_offline_id,
    'completed', true
  )
  RETURNING id INTO v_sale_id;

  -- Insert items and stock movements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total := ROUND((v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric, 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, product_name, quantity,
      unit_price, discount_amount, tax_amount, total_amount
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      COALESCE(v_item->>'product_name', ''),
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      COALESCE((v_item->>'tax_amount')::numeric, 0),
      v_item_total
    );

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

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO public.payments (
      sale_id, payment_method, amount,
      mpesa_reference, mpesa_phone, status
    ) VALUES (
      v_sale_id,
      v_payment->>'payment_method',
      (v_payment->>'amount')::numeric,
      v_payment->>'mpesa_reference',
      v_payment->>'mpesa_phone',
      'completed'
    );
  END LOOP;

  -- Update customer stats
  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_purchases = COALESCE(total_purchases, 0) + v_calc_total,
        visit_count = COALESCE(visit_count, 0) + 1,
        updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'status', 'completed',
    'receipt_number', p_receipt_number
  );

EXCEPTION
  WHEN unique_violation THEN
    -- IDEMPOTENCY: offline_id collision = already synced
    IF p_offline_id IS NOT NULL THEN
      SELECT id INTO v_sale_id FROM public.sales WHERE offline_id = p_offline_id;
      IF v_sale_id IS NOT NULL THEN
        RETURN jsonb_build_object('sale_id', v_sale_id, 'status', 'already_synced');
      END IF;
    END IF;
    RAISE;
END;
$$;
