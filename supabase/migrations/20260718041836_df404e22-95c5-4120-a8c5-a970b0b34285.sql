
-- ============================================================
-- 1. Enforce NOT NULL business_id on all tenant-scoped tables
--    (Safe: prior audit confirmed zero NULL rows.)
-- ============================================================
ALTER TABLE public.goods_received_notes   ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.purchase_orders        ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.returns                ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.sales                  ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.stock_movements        ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.products               ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.categories             ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.customers              ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.payable_transactions   ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.promotions             ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.legal_cases            ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.parties                ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.receipt_settings       ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.reorder_rules          ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.printer_configurations ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.cashier_shifts         ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.stock_transfers        ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.current_stock          ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.branch_inventory       ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.credit_transactions    ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.installment_plans      ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.promo_redemptions      ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- 2. Fix: returns INSERT must set processed_by = auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Members create returns in their branch" ON public.returns;
CREATE POLICY "Members create returns in their branch"
  ON public.returns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND processed_by = auth.uid()
    AND is_member_of_business(business_id)
    AND EXISTS (
      SELECT 1 FROM public.branch_users bu
       WHERE bu.branch_id = returns.branch_id
         AND bu.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Fix: sales INSERT must have a business (remove NULL bypass)
-- ============================================================
DROP POLICY IF EXISTS "Users can create sales in their business + branch" ON public.sales;
CREATE POLICY "Users can create sales in their business + branch"
  ON public.sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND cashier_id = auth.uid()
    AND is_member_of_business(business_id)
    AND EXISTS (
      SELECT 1 FROM public.branch_users
       WHERE branch_users.branch_id = sales.branch_id
         AND branch_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. Fix: manager stock_movements INSERT must attribute created_by
-- ============================================================
DROP POLICY IF EXISTS "Managers and above can create stock movements" ON public.stock_movements;
CREATE POLICY "Managers and above can create stock movements"
  ON public.stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager'])
  );
