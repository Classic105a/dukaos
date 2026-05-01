-- ============================================================================
-- PART 1: pgTAP for testing (safe if already installed)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;

-- ============================================================================
-- PART 2: Ensure every branch has a business_id (backfill)
-- ============================================================================

-- Create a default business for each distinct owner that has branches but no business
DO $$
DECLARE
  v_owner_id uuid;
  v_biz_id uuid;
BEGIN
  -- For each distinct owner in user_roles, ensure they have at least one business
  FOR v_owner_id IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('owner', 'admin')
  LOOP
    SELECT id INTO v_biz_id
    FROM public.businesses
    WHERE created_by = v_owner_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_biz_id IS NULL THEN
      INSERT INTO public.businesses (name, type, created_by, currency, is_active)
      VALUES ('My Business', 'retail', v_owner_id, 'KES', true)
      RETURNING id INTO v_biz_id;

      INSERT INTO public.business_users (business_id, user_id, role, is_owner)
      VALUES (v_biz_id, v_owner_id, 'owner', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Assign branches with NULL business_id to the first business of any owner
UPDATE public.branches b
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1)
WHERE business_id IS NULL
  AND EXISTS (SELECT 1 FROM public.businesses);

-- For every business, ensure all members of that business are also assigned to its branches
INSERT INTO public.business_users (business_id, user_id, role, is_owner)
SELECT DISTINCT b.business_id, bu.user_id, 'staff', false
FROM public.branches b
JOIN public.branch_users bu ON bu.branch_id = b.id
WHERE b.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Now make branches.business_id NOT NULL (only if no orphans remain)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE business_id IS NULL) THEN
    ALTER TABLE public.branches ALTER COLUMN business_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Add business_id to all tenant-scoped tables + backfill from branch
-- ============================================================================

-- Helper: add column if missing
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'products','customers','sales','stock_movements','current_stock',
    'cashier_shifts','returns','credit_transactions','installment_plans',
    'reorder_rules','branch_inventory','audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid', t
    );
  END LOOP;
END $$;

-- Backfill from branch_id where present
UPDATE public.products p
SET business_id = b.business_id
FROM public.branches b
WHERE p.branch_id = b.id AND p.business_id IS NULL;

-- Products with no branch (shared) → assign to first business
UPDATE public.products
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1)
WHERE business_id IS NULL;

UPDATE public.sales s SET business_id = b.business_id
  FROM public.branches b WHERE s.branch_id = b.id AND s.business_id IS NULL;

UPDATE public.stock_movements s SET business_id = b.business_id
  FROM public.branches b WHERE s.branch_id = b.id AND s.business_id IS NULL;

UPDATE public.current_stock cs SET business_id = b.business_id
  FROM public.branches b WHERE cs.branch_id = b.id AND cs.business_id IS NULL;

UPDATE public.cashier_shifts cs SET business_id = b.business_id
  FROM public.branches b WHERE cs.branch_id = b.id AND cs.business_id IS NULL;

UPDATE public.returns r SET business_id = b.business_id
  FROM public.branches b WHERE r.branch_id = b.id AND r.business_id IS NULL;

UPDATE public.reorder_rules rr SET business_id = b.business_id
  FROM public.branches b WHERE rr.branch_id = b.id AND rr.business_id IS NULL;

UPDATE public.branch_inventory bi SET business_id = b.business_id
  FROM public.branches b WHERE bi.branch_id = b.id AND bi.business_id IS NULL;

UPDATE public.audit_logs al SET business_id = b.business_id
  FROM public.branches b WHERE al.branch_id = b.id AND al.business_id IS NULL;

-- credit_transactions: derive via sale → branch
UPDATE public.credit_transactions ct
SET business_id = s.business_id
FROM public.sales s
WHERE ct.sale_id = s.id AND ct.business_id IS NULL;

UPDATE public.credit_transactions
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1)
WHERE business_id IS NULL;

-- installment_plans: via sale
UPDATE public.installment_plans ip
SET business_id = s.business_id
FROM public.sales s
WHERE ip.sale_id = s.id AND ip.business_id IS NULL;

UPDATE public.installment_plans
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1)
WHERE business_id IS NULL;

-- customers: assign all to first business (customers are not branch-scoped)
UPDATE public.customers
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1)
WHERE business_id IS NULL;

-- audit_logs without branch_id → first business
UPDATE public.audit_logs
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1)
WHERE business_id IS NULL;

-- Indexes for tenant lookups
CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_business ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON public.stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_current_stock_business ON public.current_stock(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON public.audit_logs(business_id);

-- ============================================================================
-- PART 4: Membership helper + tightened RLS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_member_of_business(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE business_id = _business_id AND user_id = auth.uid()
  )
$$;

-- SALES: tighten so cashier must also belong to business
DROP POLICY IF EXISTS "Users can create sales for their assigned branches" ON public.sales;
CREATE POLICY "Users can create sales in their business + branch"
ON public.sales FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cashier_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.branch_users WHERE branch_id = sales.branch_id AND user_id = auth.uid())
  AND (business_id IS NULL OR public.is_member_of_business(business_id))
);

DROP POLICY IF EXISTS "Users can view own sales or managers view all" ON public.sales;
CREATE POLICY "Users view sales in their business"
ON public.sales FOR SELECT
USING (
  (business_id IS NULL OR public.is_member_of_business(business_id))
  AND (
    cashier_id = auth.uid()
    OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  )
);

-- PRODUCTS: tenant-scoped read
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Members can view products in their business"
ON public.products FOR SELECT
USING (
  is_active = true
  AND (business_id IS NULL OR public.is_member_of_business(business_id))
);

-- CUSTOMERS: tenant-scoped
DROP POLICY IF EXISTS "Cashiers can view customers for sales" ON public.customers;
CREATE POLICY "Members view customers in their business"
ON public.customers FOR SELECT
USING (business_id IS NULL OR public.is_member_of_business(business_id));

-- AUDIT LOGS: tenant-scoped read
DROP POLICY IF EXISTS "Managers can view audit logs" ON public.audit_logs;
CREATE POLICY "Managers view audit logs in their business"
ON public.audit_logs FOR SELECT
USING (
  (business_id IS NULL OR public.is_member_of_business(business_id))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- ============================================================================
-- PART 5: Gapless receipt sequences (per-branch, daily reset)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.receipt_sequences (
  branch_id uuid NOT NULL,
  seq_date date NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, seq_date)
);

ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read receipt sequences for their branches"
ON public.receipt_sequences FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.branch_users WHERE branch_id = receipt_sequences.branch_id AND user_id = auth.uid())
);

-- Branch shortcode column for receipt prefix (e.g. "BR01")
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS receipt_prefix text;

-- Backfill prefixes: BR + first 4 of branch id
UPDATE public.branches
SET receipt_prefix = 'BR' || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE receipt_prefix IS NULL;

CREATE OR REPLACE FUNCTION public.next_receipt_number(p_branch_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Nairobi')::date;
  v_next bigint;
  v_prefix text;
BEGIN
  -- Lock & increment counter for (branch, day)
  INSERT INTO public.receipt_sequences (branch_id, seq_date, last_value)
  VALUES (p_branch_id, v_today, 1)
  ON CONFLICT (branch_id, seq_date)
  DO UPDATE SET last_value = receipt_sequences.last_value + 1,
                updated_at = now()
  RETURNING last_value INTO v_next;

  SELECT COALESCE(receipt_prefix, 'BR' || UPPER(SUBSTR(REPLACE(p_branch_id::text, '-', ''), 1, 4)))
  INTO v_prefix FROM public.branches WHERE id = p_branch_id;

  RETURN v_prefix || '-' || TO_CHAR(v_today, 'YYYYMMDD') || '-' || LPAD(v_next::text, 4, '0');
END;
$$;

-- ============================================================================
-- PART 6: Updated complete_sale — auto receipt + business_id propagation
-- ============================================================================

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

  -- Resolve business_id from branch + check membership
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
  v_discount := COALESCE(p_discount_amount, 0);

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

  IF v_discount > v_calc_subtotal THEN v_discount := v_calc_subtotal; END IF;

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

  -- Receipt number: server-generates if client passed null/blank (online sales)
  -- otherwise honors client receipt (offline sync, legacy clients)
  IF p_receipt_number IS NULL OR p_receipt_number = '' THEN
    v_receipt_number := public.next_receipt_number(p_branch_id);
  ELSE
    v_receipt_number := p_receipt_number;
  END IF;

  -- Insert sale (with business_id)
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
      'offline_id', p_offline_id
    )
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id, 'status', 'completed',
    'receipt_number', v_receipt_number, 'business_id', v_business_id,
    'server_total', v_calc_total, 'tax_extracted', v_calc_tax,
    'vat_rate', v_vat_rate, 'change', v_change
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

-- ============================================================================
-- PART 7: pgTAP test suite
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_complete_sale_tests()
RETURNS SETOF text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq1 text;
  v_seq2 text;
  v_branch uuid;
BEGIN
  RETURN NEXT plan(5);

  -- Test 1: next_receipt_number is monotonic per branch/day
  SELECT id INTO v_branch FROM public.branches LIMIT 1;
  IF v_branch IS NOT NULL THEN
    v_seq1 := public.next_receipt_number(v_branch);
    v_seq2 := public.next_receipt_number(v_branch);
    RETURN NEXT ok(v_seq2 > v_seq1, 'receipt sequence is monotonic');
  ELSE
    RETURN NEXT skip('no branch to test receipts');
  END IF;

  -- Test 2: every sale has a business_id post-migration
  RETURN NEXT ok(
    NOT EXISTS (SELECT 1 FROM public.sales WHERE business_id IS NULL),
    'all sales have business_id'
  );

  -- Test 3: every product has a business_id
  RETURN NEXT ok(
    NOT EXISTS (SELECT 1 FROM public.products WHERE business_id IS NULL),
    'all products have business_id'
  );

  -- Test 4: branches all assigned
  RETURN NEXT ok(
    NOT EXISTS (SELECT 1 FROM public.branches WHERE business_id IS NULL),
    'all branches have business_id'
  );

  -- Test 5: is_member_of_business helper exists & is stable
  RETURN NEXT has_function('public', 'is_member_of_business', ARRAY['uuid']);
END;
$$;