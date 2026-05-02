
-- ============================================================
-- 1. OBSERVABILITY: error_logs + perf_metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  business_id uuid,
  branch_id uuid,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('debug','info','warn','error','fatal')),
  source text NOT NULL,                 -- 'client' | 'rpc' | 'edge' | 'sync'
  message text NOT NULL,
  stack text,
  route text,
  context jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_business_created ON public.error_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity_created ON public.error_logs(severity, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own error logs"
ON public.error_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
  AND (business_id IS NULL OR public.is_member_of_business(business_id))
);

CREATE POLICY "Managers view error logs in their business"
ON public.error_logs FOR SELECT
USING (
  ((business_id IS NULL) OR public.is_member_of_business(business_id))
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE TABLE IF NOT EXISTS public.perf_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  business_id uuid,
  branch_id uuid,
  metric text NOT NULL,                 -- 'sale_latency_ms' | 'sync_latency_ms' | 'db_latency_ms' | ...
  value_ms numeric(12,2) NOT NULL,
  route text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_business_metric_created ON public.perf_metrics(business_id, metric, created_at DESC);

ALTER TABLE public.perf_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own perf metrics"
ON public.perf_metrics FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
  AND (business_id IS NULL OR public.is_member_of_business(business_id))
);

CREATE POLICY "Managers view perf metrics in their business"
ON public.perf_metrics FOR SELECT
USING (
  ((business_id IS NULL) OR public.is_member_of_business(business_id))
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

-- ============================================================
-- 2. PROMOTIONS ENFORCEMENT: promo_redemptions audit table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL,
  business_id uuid,
  branch_id uuid,
  sale_id uuid NOT NULL,
  customer_id uuid,
  cashier_id uuid NOT NULL,
  cart_subtotal numeric(12,2) NOT NULL,
  discount_applied numeric(12,2) NOT NULL,
  promo_snapshot jsonb,                 -- snapshot of promo at redemption time
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON public.promo_redemptions(promotion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_business_created ON public.promo_redemptions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_sale ON public.promo_redemptions(sale_id);

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view promo redemptions in their business"
ON public.promo_redemptions FOR SELECT
USING ((business_id IS NULL) OR public.is_member_of_business(business_id));
-- No INSERT policy: only complete_sale (SECURITY DEFINER) writes here.

CREATE INDEX IF NOT EXISTS idx_promotions_business_active ON public.promotions(business_id, is_active, start_date, end_date);

-- ============================================================
-- 3. PERFORMANCE: composite indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_business_created ON public.sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branch_created ON public.sales(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_created ON public.sales(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON public.sales(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_current_stock_branch_product ON public.current_stock(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_products_business_active ON public.products(business_id, is_active);

-- ============================================================
-- 4. PERFORMANCE: materialized view for daily sales summary
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS public.daily_sales_summary;
CREATE MATERIALIZED VIEW public.daily_sales_summary AS
SELECT
  s.business_id,
  s.branch_id,
  (s.created_at AT TIME ZONE 'Africa/Nairobi')::date AS sale_date,
  COUNT(*)::bigint                              AS transaction_count,
  COALESCE(SUM(s.total_amount), 0)::numeric(14,2) AS revenue,
  COALESCE(SUM(s.cost_total), 0)::numeric(14,2)   AS cost,
  COALESCE(SUM(s.profit_total), 0)::numeric(14,2) AS profit,
  COALESCE(SUM(s.tax_amount), 0)::numeric(14,2)   AS tax,
  COALESCE(SUM(s.discount_amount), 0)::numeric(14,2) AS discount,
  COALESCE(AVG(s.total_amount), 0)::numeric(14,2) AS avg_order_value
FROM public.sales s
WHERE s.payment_status = 'completed'
GROUP BY s.business_id, s.branch_id, (s.created_at AT TIME ZONE 'Africa/Nairobi')::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_summary_unique
  ON public.daily_sales_summary(business_id, branch_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_business_date
  ON public.daily_sales_summary(business_id, sale_date DESC);

-- Refresh function (concurrent so reads aren't blocked)
CREATE OR REPLACE FUNCTION public.refresh_daily_sales_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_sales_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_daily_sales_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_daily_sales_summary() TO authenticated, service_role;

-- Members can read summary rows for their business via a SECURITY DEFINER wrapper.
-- (Materialized views don't support RLS directly; restrict via grants + wrapper.)
REVOKE ALL ON public.daily_sales_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.daily_sales_summary TO service_role;

CREATE OR REPLACE FUNCTION public.get_daily_sales_summary(
  p_business_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
)
RETURNS SETOF public.daily_sales_summary
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_member_of_business(p_business_id) THEN
    RAISE EXCEPTION 'Not a member of business';
  END IF;

  RETURN QUERY
  SELECT * FROM public.daily_sales_summary d
  WHERE d.business_id = p_business_id
    AND (p_branch_id IS NULL OR d.branch_id = p_branch_id)
    AND (p_start_date IS NULL OR d.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR d.sale_date <= p_end_date)
  ORDER BY d.sale_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_sales_summary(uuid, date, date, uuid) TO authenticated;

-- ============================================================
-- 5. complete_sale: server-side promotion enforcement
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
  p_offline_id text DEFAULT NULL,
  p_promotion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id uuid;
  v_actual_cashier uuid;
  v_business_id uuid;
  v_item jsonb;
  v_payment jsonb;
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
BEGIN
  v_actual_cashier := auth.uid();
  IF v_actual_cashier IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_id = p_branch_id AND user_id = v_actual_cashier
  ) THEN
    RAISE EXCEPTION 'Cashier not assigned to this branch';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create sale with no items';
  END IF;

  SELECT business_id, COALESCE(default_tax_rate, 16.00)
  INTO v_business_id, v_vat_rate
  FROM public.branches WHERE id = p_branch_id;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Branch has no business assigned';
  END IF;

  IF NOT public.is_member_of_business(v_business_id) THEN
    RAISE EXCEPTION 'Cashier not a member of this business';
  END IF;

  v_vat_rate := COALESCE(v_vat_rate, 16.00);
  v_vat_divisor := 1 + (v_vat_rate / 100);

  -- Server-side pricing (ignore client values)
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

  -- ─── Promotion enforcement (server is sole authority) ───
  IF p_promotion_id IS NOT NULL THEN
    SELECT * INTO v_promo
    FROM public.promotions
    WHERE id = p_promotion_id AND business_id = v_business_id
    FOR UPDATE;

    IF v_promo.id IS NULL THEN
      RAISE EXCEPTION 'Promotion not found or not in this business';
    END IF;
    IF NOT v_promo.is_active THEN
      RAISE EXCEPTION 'Promotion is not active';
    END IF;
    IF v_promo.start_date IS NOT NULL AND v_promo.start_date > now() THEN
      RAISE EXCEPTION 'Promotion has not started';
    END IF;
    IF v_promo.end_date IS NOT NULL AND v_promo.end_date < now() THEN
      RAISE EXCEPTION 'Promotion has expired';
    END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
      RAISE EXCEPTION 'Promotion redemption limit reached';
    END IF;

    -- Compute eligible subtotal based on applies_to scope
    IF v_promo.applies_to = 'all' THEN
      v_promo_eligible_subtotal := v_calc_subtotal;
      SELECT COALESCE(SUM((elem->>'quantity')::integer), 0) INTO v_promo_qty
      FROM jsonb_array_elements(p_items) AS elem;
    ELSIF v_promo.applies_to = 'products' THEN
      SELECT
        COALESCE(SUM((e->>'quantity')::integer * p.unit_price), 0),
        COALESCE(SUM((e->>'quantity')::integer), 0)
      INTO v_promo_eligible_subtotal, v_promo_qty
      FROM jsonb_array_elements(p_items) e
      JOIN public.products p ON p.id = (e->>'product_id')::uuid
      WHERE p.id = ANY(COALESCE(v_promo.product_ids, ARRAY[]::uuid[]));
    ELSIF v_promo.applies_to = 'categories' THEN
      SELECT
        COALESCE(SUM((e->>'quantity')::integer * p.unit_price), 0),
        COALESCE(SUM((e->>'quantity')::integer), 0)
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

    -- Compute discount
    IF v_promo.promotion_type = 'percentage_discount' THEN
      v_promo_discount := ROUND(v_promo_eligible_subtotal * (v_promo.discount_value / 100.0), 2);
    ELSIF v_promo.promotion_type = 'fixed_discount' THEN
      v_promo_discount := LEAST(ROUND(v_promo.discount_value, 2), v_promo_eligible_subtotal);
    ELSIF v_promo.promotion_type = 'bogo' THEN
      -- Buy-one-get-one: discount = floor(qty/2) * unit_price (approximated as half eligible)
      v_promo_discount := ROUND(v_promo_eligible_subtotal / 2.0, 2);
    ELSE
      v_promo_discount := ROUND(v_promo.discount_value, 2);
    END IF;

    v_discount := LEAST(v_promo_discount, v_calc_subtotal);

    -- Atomically increment uses
    UPDATE public.promotions
    SET current_uses = current_uses + 1, updated_at = now()
    WHERE id = p_promotion_id;
  ELSE
    -- No promotion: honor client-passed manual discount (pre-existing behavior)
    v_discount := COALESCE(p_discount_amount, 0);
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
    v_payment_total := v_payment_total + ROUND((v_payment->>'amount')::numeric, 2);
    IF (v_payment->>'payment_method') = 'cash' THEN
      v_cash_total := v_cash_total + ROUND((v_payment->>'amount')::numeric, 2);
    ELSE
      v_non_cash_total := v_non_cash_total + ROUND((v_payment->>'amount')::numeric, 2);
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

  -- Stock locking + atomic deduction
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
    v_calc_cost, v_calc_profit, p_shift_id, p_notes, p_offline_id,
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
      v_payment->>'mpesa_reference', v_payment->>'mpesa_phone', 'completed'
    );
  END LOOP;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_purchases = COALESCE(total_purchases, 0) + v_calc_total,
        visit_count = COALESCE(visit_count, 0) + 1, updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  -- Promo redemption audit
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
    IF p_offline_id IS NOT NULL THEN
      SELECT id INTO v_sale_id FROM public.sales WHERE offline_id = p_offline_id;
      IF v_sale_id IS NOT NULL THEN
        RETURN jsonb_build_object('sale_id', v_sale_id, 'status', 'already_synced');
      END IF;
    END IF;
    RAISE;
END;
$function$;
