
-- ============================================================================
-- TRACK A: SECURITY BACKFILL — Tenant Isolation Hardening
-- ============================================================================

-- Helper: derive business_id from branch_id
CREATE OR REPLACE FUNCTION public.business_id_from_branch(_branch_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.branches WHERE id = _branch_id LIMIT 1;
$$;

-- ─── 1. CATEGORIES ───────────────────────────────────────────────
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS business_id uuid;

UPDATE public.categories c
SET business_id = (SELECT id FROM public.businesses ORDER BY created_at LIMIT 1)
WHERE c.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_business ON public.categories(business_id);

DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
CREATE POLICY "Members view categories in their business"
  ON public.categories FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 2. BRANCHES (already has business_id, just tighten policy) ──
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
CREATE POLICY "Members view branches in their business"
  ON public.branches FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 3. CURRENT_STOCK ────────────────────────────────────────────
UPDATE public.current_stock cs
SET business_id = b.business_id
FROM public.branches b
WHERE cs.branch_id = b.id AND cs.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_current_stock_business ON public.current_stock(business_id);

DROP POLICY IF EXISTS "Auth users can view stock" ON public.current_stock;
CREATE POLICY "Members view stock in their business"
  ON public.current_stock FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 4. BRANCH_INVENTORY ─────────────────────────────────────────
UPDATE public.branch_inventory bi
SET business_id = b.business_id
FROM public.branches b
WHERE bi.branch_id = b.id AND bi.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_branch_inventory_business ON public.branch_inventory(business_id);

DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.branch_inventory;
CREATE POLICY "Members view inventory in their business"
  ON public.branch_inventory FOR SELECT TO authenticated
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 5. PARTIES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_parties_business ON public.parties(business_id);

DROP POLICY IF EXISTS "Auth users can view parties" ON public.parties;
CREATE POLICY "Members view parties in their business"
  ON public.parties FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 6. LEGAL_CASES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_legal_cases_business ON public.legal_cases(business_id);

DROP POLICY IF EXISTS "Auth users can view legal cases" ON public.legal_cases;
CREATE POLICY "Members view legal cases in their business"
  ON public.legal_cases FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 7. PAYABLE_TRANSACTIONS ─────────────────────────────────────
UPDATE public.payable_transactions pt
SET business_id = p.business_id
FROM public.parties p
WHERE pt.party_id = p.id AND pt.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payable_tx_business ON public.payable_transactions(business_id);

DROP POLICY IF EXISTS "Auth users can view payables" ON public.payable_transactions;
CREATE POLICY "Members view payables in their business"
  ON public.payable_transactions FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 8. PURCHASE_ORDERS ──────────────────────────────────────────
UPDATE public.purchase_orders po
SET business_id = b.business_id
FROM public.branches b
WHERE po.branch_id = b.id AND po.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_business ON public.purchase_orders(business_id);

DROP POLICY IF EXISTS "Auth users can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Members view purchase orders in their business"
  ON public.purchase_orders FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 9. PURCHASE_ORDER_ITEMS (scoped via parent PO) ──────────────
DROP POLICY IF EXISTS "Auth users can view PO items" ON public.purchase_order_items;
CREATE POLICY "Members view PO items in their business"
  ON public.purchase_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND (po.business_id IS NULL OR is_member_of_business(po.business_id))
  ));

-- ─── 10. GOODS_RECEIVED_NOTES ────────────────────────────────────
ALTER TABLE public.goods_received_notes ADD COLUMN IF NOT EXISTS business_id uuid;

UPDATE public.goods_received_notes grn
SET business_id = b.business_id
FROM public.branches b
WHERE grn.branch_id = b.id AND grn.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_grn_business ON public.goods_received_notes(business_id);

DROP POLICY IF EXISTS "Auth users can view GRNs" ON public.goods_received_notes;
CREATE POLICY "Members view GRNs in their business"
  ON public.goods_received_notes FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 11. GRN_ITEMS (scoped via parent GRN) ───────────────────────
DROP POLICY IF EXISTS "Auth users can view GRN items" ON public.grn_items;
CREATE POLICY "Members view GRN items in their business"
  ON public.grn_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.goods_received_notes grn
    WHERE grn.id = grn_items.grn_id
      AND (grn.business_id IS NULL OR is_member_of_business(grn.business_id))
  ));

-- ─── 12. PRINTER_CONFIGURATIONS (sensitive: hides IPs/MACs) ──────
ALTER TABLE public.printer_configurations ADD COLUMN IF NOT EXISTS business_id uuid;

UPDATE public.printer_configurations pc
SET business_id = b.business_id
FROM public.branches b
WHERE pc.branch_id = b.id AND pc.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_printer_config_business ON public.printer_configurations(business_id);

DROP POLICY IF EXISTS "Authenticated users can view printer configurations" ON public.printer_configurations;
CREATE POLICY "Members view printers in their business"
  ON public.printer_configurations FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 13. INSTALLMENT_PLANS ───────────────────────────────────────
UPDATE public.installment_plans ip
SET business_id = c.business_id
FROM public.customers c
WHERE ip.customer_id = c.id AND ip.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_installment_business ON public.installment_plans(business_id);

DROP POLICY IF EXISTS "Authenticated users can view installment plans" ON public.installment_plans;
CREATE POLICY "Members view installment plans in their business"
  ON public.installment_plans FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 14. CREDIT_TRANSACTIONS ─────────────────────────────────────
UPDATE public.credit_transactions ct
SET business_id = c.business_id
FROM public.customers c
WHERE ct.customer_id = c.id AND ct.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_credit_tx_business ON public.credit_transactions(business_id);

DROP POLICY IF EXISTS "Authenticated users can view credit transactions" ON public.credit_transactions;
CREATE POLICY "Members view credit transactions in their business"
  ON public.credit_transactions FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── 15. PROMOTIONS ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_promotions_business ON public.promotions(business_id);

DROP POLICY IF EXISTS "Auth users can view active promotions" ON public.promotions;
CREATE POLICY "Members view promotions in their business"
  ON public.promotions FOR SELECT
  USING (business_id IS NULL OR is_member_of_business(business_id));

-- ─── AUTO-STAMP TRIGGERS ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stamp_business_from_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_id IS NULL AND NEW.branch_id IS NOT NULL THEN
    NEW.business_id := business_id_from_branch(NEW.branch_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_biz_current_stock ON public.current_stock;
CREATE TRIGGER trg_stamp_biz_current_stock BEFORE INSERT ON public.current_stock
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();

DROP TRIGGER IF EXISTS trg_stamp_biz_branch_inventory ON public.branch_inventory;
CREATE TRIGGER trg_stamp_biz_branch_inventory BEFORE INSERT ON public.branch_inventory
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();

DROP TRIGGER IF EXISTS trg_stamp_biz_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trg_stamp_biz_purchase_orders BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();

DROP TRIGGER IF EXISTS trg_stamp_biz_grn ON public.goods_received_notes;
CREATE TRIGGER trg_stamp_biz_grn BEFORE INSERT ON public.goods_received_notes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();

DROP TRIGGER IF EXISTS trg_stamp_biz_printer ON public.printer_configurations;
CREATE TRIGGER trg_stamp_biz_printer BEFORE INSERT ON public.printer_configurations
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_from_branch();

-- ─── PERFORMANCE INDEXES (Track B prep) ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_branch_created ON public.sales(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_branch ON public.stock_movements(product_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_business_active ON public.products(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_updated ON public.products(updated_at DESC);
