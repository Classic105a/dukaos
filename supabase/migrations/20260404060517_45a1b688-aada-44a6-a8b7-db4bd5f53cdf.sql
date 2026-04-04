
-- ============================================================
-- 1. ATOMIC SALE COMPLETION FUNCTION (concurrency-safe)
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
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_current_stock integer;
  v_product_name text;
  v_existing_sale_id uuid;
BEGIN
  -- Idempotency check for offline sync
  IF p_offline_id IS NOT NULL THEN
    SELECT id INTO v_existing_sale_id
    FROM public.sales
    WHERE offline_id = p_offline_id;
    
    IF v_existing_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object('sale_id', v_existing_sale_id, 'status', 'already_synced');
    END IF;
  END IF;

  -- Verify cashier is assigned to branch
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_id = p_branch_id AND user_id = p_cashier_id
  ) THEN
    RAISE EXCEPTION 'Cashier is not assigned to this branch';
  END IF;

  -- Lock and validate stock for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get product name
    SELECT name INTO v_product_name
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id';
    END IF;

    -- Lock stock rows and compute current stock
    SELECT COALESCE(SUM(quantity_change), 0) INTO v_current_stock
    FROM public.stock_movements
    WHERE product_id = (v_item->>'product_id')::uuid
      AND branch_id = p_branch_id
    FOR UPDATE;

    -- Validate sufficient stock (skip for non-tracked products)
    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE id = (v_item->>'product_id')::uuid AND track_inventory = true
    ) AND v_current_stock < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
        v_product_name, v_current_stock, (v_item->>'quantity')::integer;
    END IF;
  END LOOP;

  -- Insert sale
  INSERT INTO public.sales (
    branch_id, cashier_id, customer_id, receipt_number,
    subtotal, tax_amount, discount_amount, total_amount,
    cost_total, profit_total, shift_id, notes, offline_id,
    payment_status, is_synced
  ) VALUES (
    p_branch_id, p_cashier_id, p_customer_id, p_receipt_number,
    p_subtotal, p_tax_amount, p_discount_amount, p_total_amount,
    p_cost_total, p_profit_total, p_shift_id, p_notes, p_offline_id,
    'completed', true
  )
  RETURNING id INTO v_sale_id;

  -- Insert sale items and stock movements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
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
      (v_item->>'total_amount')::numeric
    );

    -- Insert stock movement
    INSERT INTO public.stock_movements (
      product_id, branch_id, quantity_change,
      movement_type, reference_id, created_by, notes
    ) VALUES (
      (v_item->>'product_id')::uuid,
      p_branch_id,
      -(v_item->>'quantity')::integer,
      'SALE',
      v_sale_id,
      p_cashier_id,
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

  -- Update customer stats if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_purchases = COALESCE(total_purchases, 0) + p_total_amount,
        visit_count = COALESCE(visit_count, 0) + 1,
        updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'status', 'completed',
    'receipt_number', p_receipt_number
  );
END;
$$;

-- ============================================================
-- 2. DASHBOARD ANALYTICS FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_branch_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(total_amount), 0),
    'total_profit', COALESCE(SUM(profit_total), 0),
    'total_cost', COALESCE(SUM(cost_total), 0),
    'sale_count', COUNT(*),
    'avg_sale', CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(total_amount) / COUNT(*), 2) ELSE 0 END,
    'total_tax', COALESCE(SUM(tax_amount), 0),
    'total_discount', COALESCE(SUM(discount_amount), 0)
  )
  FROM public.sales
  WHERE branch_id = p_branch_id
    AND payment_status = 'completed'
    AND created_at >= p_start_date
    AND created_at < p_end_date;
$$;

CREATE OR REPLACE FUNCTION public.get_top_products(
  p_branch_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  FROM (
    SELECT
      si.product_id,
      si.product_name,
      SUM(si.quantity) AS total_qty,
      SUM(si.total_amount) AS total_revenue
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.branch_id = p_branch_id
      AND s.payment_status = 'completed'
      AND s.created_at >= p_start_date
      AND s.created_at < p_end_date
    GROUP BY si.product_id, si.product_name
    ORDER BY SUM(si.quantity) DESC
    LIMIT p_limit
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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
  ) t;
$$;

-- ============================================================
-- 3. STANDARDIZE MONETARY PRECISION
-- ============================================================

ALTER TABLE public.sales
  ALTER COLUMN cost_total TYPE numeric(12,2),
  ALTER COLUMN profit_total TYPE numeric(12,2);

ALTER TABLE public.cashier_shifts
  ALTER COLUMN opening_float TYPE numeric(12,2),
  ALTER COLUMN expected_cash TYPE numeric(12,2),
  ALTER COLUMN actual_cash TYPE numeric(12,2),
  ALTER COLUMN cash_discrepancy TYPE numeric(12,2);

ALTER TABLE public.credit_transactions
  ALTER COLUMN amount TYPE numeric(12,2),
  ALTER COLUMN running_balance TYPE numeric(12,2);

ALTER TABLE public.installment_plans
  ALTER COLUMN total_amount TYPE numeric(12,2),
  ALTER COLUMN installment_amount TYPE numeric(12,2),
  ALTER COLUMN remaining_amount TYPE numeric(12,2);

ALTER TABLE public.payable_transactions
  ALTER COLUMN amount TYPE numeric(12,2),
  ALTER COLUMN running_balance TYPE numeric(12,2);

ALTER TABLE public.purchase_orders
  ALTER COLUMN subtotal TYPE numeric(12,2),
  ALTER COLUMN tax_amount TYPE numeric(12,2),
  ALTER COLUMN total_amount TYPE numeric(12,2);

ALTER TABLE public.goods_received_notes
  ALTER COLUMN total_value TYPE numeric(12,2);

ALTER TABLE public.grn_items
  ALTER COLUMN unit_cost TYPE numeric(12,2),
  ALTER COLUMN total_cost TYPE numeric(12,2);

ALTER TABLE public.promotions
  ALTER COLUMN discount_value TYPE numeric(12,2),
  ALTER COLUMN min_purchase_amount TYPE numeric(12,2);

ALTER TABLE public.parties
  ALTER COLUMN opening_balance TYPE numeric(12,2),
  ALTER COLUMN current_balance TYPE numeric(12,2);

ALTER TABLE public.customers
  ALTER COLUMN credit_limit TYPE numeric(12,2),
  ALTER COLUMN credit_balance TYPE numeric(12,2);

ALTER TABLE public.payments
  ALTER COLUMN amount TYPE numeric(12,2);

ALTER TABLE public.legal_cases
  ALTER COLUMN amount_claimed TYPE numeric(12,2);

-- ============================================================
-- 4. ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;

-- ============================================================
-- 5. ADD INDEXES FOR ANALYTICS PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sales_branch_created ON public.sales (branch_id, created_at)
  WHERE payment_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_branch ON public.stock_movements (product_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_sales_offline_id ON public.sales (offline_id)
  WHERE offline_id IS NOT NULL;
