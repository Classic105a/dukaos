
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
  v_calc_tax numeric(12,2) := 0;
  v_item_total numeric(12,2);
  v_item_tax numeric(12,2);
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
  v_vat_rate numeric(5,2) := 16.00;
  v_vat_divisor numeric(12,6);
BEGIN
  -- ======== AUTHENTICATION ========
  v_actual_cashier := auth.uid();
  IF v_actual_cashier IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_id = p_branch_id AND user_id = v_actual_cashier
  ) THEN
    RAISE EXCEPTION 'Cashier not assigned to this branch';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create sale with no items';
  END IF;

  -- Pre-compute VAT divisor once
  v_vat_divisor := 1 + (v_vat_rate / 100);

  -- ======== SERVER-SIDE PRICING ========
  -- ALL prices are TAX-INCLUSIVE. Client-provided prices/tax are IGNORED.
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

  -- TAX-INCLUSIVE ACCOUNTING:
  --   subtotal  = sum of line totals (prices already include tax)
  --   tax       = extracted from subtotal: subtotal - (subtotal / 1.16)
  --   total     = subtotal - discount  (customer pays this)
  --   p_tax_amount from client is IGNORED
  v_calc_tax := ROUND(v_calc_subtotal - (v_calc_subtotal / v_vat_divisor), 2);
  v_calc_total := v_calc_subtotal - COALESCE(p_discount_amount, 0);
  v_calc_profit := v_calc_subtotal - v_calc_cost;

  -- ======== PAYMENT VALIDATION (strict ±1 tolerance) ========
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

  -- ======== INSERT SALE (all server-calculated) ========
  INSERT INTO public.sales (
    branch_id, cashier_id, customer_id, receipt_number,
    subtotal, tax_amount, discount_amount, total_amount,
    cost_total, profit_total, shift_id, notes, offline_id,
    payment_status, is_synced
  ) VALUES (
    p_branch_id, v_actual_cashier, p_customer_id, p_receipt_number,
    v_calc_subtotal, v_calc_tax, COALESCE(p_discount_amount, 0), v_calc_total,
    v_calc_cost, v_calc_profit, p_shift_id, p_notes, p_offline_id,
    'completed', true
  )
  RETURNING id INTO v_sale_id;

  -- ======== INSERT ITEMS (server-calculated tax per item) ========
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT unit_price, COALESCE(cost_price, 0), name
    INTO v_server_price, v_server_cost, v_product_name
    FROM public.products WHERE id = (v_item->>'product_id')::uuid;

    v_item_total := ROUND((v_item->>'quantity')::integer * v_server_price, 2);
    -- Extract tax per line item (server-side, ignoring client tax_amount)
    v_item_tax := ROUND(v_item_total - (v_item_total / v_vat_divisor), 2);

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
      v_item_tax,  -- SERVER-EXTRACTED tax, not client-provided
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

  -- ======== AUDIT LOG (server-only values) ========
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
      'tax_extracted', v_calc_tax,
      'discount', COALESCE(p_discount_amount, 0),
      'total', v_calc_total,
      'cost', v_calc_cost,
      'profit', v_calc_profit,
      'items_count', jsonb_array_length(p_items),
      'payment_total', v_payment_total,
      'vat_rate', v_vat_rate,
      'pricing_model', 'tax_inclusive',
      'offline_id', p_offline_id
    )
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'status', 'completed',
    'receipt_number', p_receipt_number,
    'server_total', v_calc_total,
    'tax_extracted', v_calc_tax
  );

EXCEPTION
  WHEN unique_violation THEN
    IF p_offline_id IS NOT NULL THEN
      SELECT id INTO v_sale_id FROM public.sales WHERE offline_id = p_offline_id;
      IF v_sale_id IS NOT NULL THEN
        RETURN jsonb_build_object('sale_id', v_sale_id, 'status', 'already_synced');
      END IF;
    END IF;
    RAISE;
END;
$$;
