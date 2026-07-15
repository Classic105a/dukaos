
-- 1. New business-scoped role check (only business_users, no cross-business bleed)
CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _business_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _business_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id
      AND business_id = _business_id
      AND status = 'active'
      AND role = ANY(_roles)
  )
$$;

-- Helpers to resolve business_id from indirect references
CREATE OR REPLACE FUNCTION public.business_id_from_sale(_sale_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT business_id FROM public.sales WHERE id = _sale_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.business_id_from_grn(_grn_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT business_id FROM public.goods_received_notes WHERE id = _grn_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.business_id_from_po(_po_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT business_id FROM public.purchase_orders WHERE id = _po_id LIMIT 1 $$;

-- 2. Rewrite policies. Pattern: manager-tier -> has_business_role(auth.uid(), <biz>, ARRAY['owner','admin','manager'])
--    admin-tier   -> has_business_role(auth.uid(), <biz>, ARRAY['owner','admin'])

-- approval_requests (branch_id -> business)
DROP POLICY IF EXISTS "Managers can update approval requests" ON public.approval_requests;
CREATE POLICY "Managers can update approval requests" ON public.approval_requests
FOR UPDATE TO authenticated
USING (has_business_role(auth.uid(), business_id_from_branch(branch_id), ARRAY['owner','admin','manager']));

DROP POLICY IF EXISTS "Users can view their own requests" ON public.approval_requests;
CREATE POLICY "Users can view their own requests" ON public.approval_requests
FOR SELECT TO authenticated
USING (requested_by = auth.uid()
  OR has_business_role(auth.uid(), business_id_from_branch(branch_id), ARRAY['owner','admin','manager']));

-- audit_logs
DROP POLICY IF EXISTS "Managers view audit logs in their business" ON public.audit_logs;
CREATE POLICY "Managers view audit logs in their business" ON public.audit_logs
FOR SELECT TO authenticated
USING (business_id IS NOT NULL
  AND has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- backup_runs
DROP POLICY IF EXISTS "Managers view backup runs in their business" ON public.backup_runs;
CREATE POLICY "Managers view backup runs in their business" ON public.backup_runs
FOR SELECT TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- branch_inventory
DROP POLICY IF EXISTS "Managers and above can manage inventory" ON public.branch_inventory;
CREATE POLICY "Managers and above can manage inventory" ON public.branch_inventory
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- branch_users (branch_id -> business)
DROP POLICY IF EXISTS "Admins can manage branch assignments" ON public.branch_users;
CREATE POLICY "Admins can manage branch assignments" ON public.branch_users
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id_from_branch(branch_id), ARRAY['owner','admin']))
WITH CHECK (has_business_role(auth.uid(), business_id_from_branch(branch_id), ARRAY['owner','admin']));

DROP POLICY IF EXISTS "Users can view their branch assignments" ON public.branch_users;
CREATE POLICY "Users can view their branch assignments" ON public.branch_users
FOR SELECT TO authenticated
USING (auth.uid() = user_id
  OR has_business_role(auth.uid(), business_id_from_branch(branch_id), ARRAY['owner','admin']));

-- branches
DROP POLICY IF EXISTS "Managers and above can manage branches" ON public.branches;
CREATE POLICY "Managers and above can manage branches" ON public.branches
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- cashier_shifts
DROP POLICY IF EXISTS "Managers can manage all shifts" ON public.cashier_shifts;
CREATE POLICY "Managers can manage all shifts" ON public.cashier_shifts
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

DROP POLICY IF EXISTS "Users can view their own shifts" ON public.cashier_shifts;
CREATE POLICY "Users can view their own shifts" ON public.cashier_shifts
FOR SELECT TO authenticated
USING (cashier_id = auth.uid()
  OR has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- categories
DROP POLICY IF EXISTS "Managers and above can manage categories" ON public.categories;
CREATE POLICY "Managers and above can manage categories" ON public.categories
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- credit_transactions
DROP POLICY IF EXISTS "Managers can manage credit transactions" ON public.credit_transactions;
CREATE POLICY "Managers can manage credit transactions" ON public.credit_transactions
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- current_stock
DROP POLICY IF EXISTS "Managers can manage stock" ON public.current_stock;
CREATE POLICY "Managers can manage stock" ON public.current_stock
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- custom_permissions
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.custom_permissions;
CREATE POLICY "Admins can manage permissions" ON public.custom_permissions
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS "Users can view own permissions" ON public.custom_permissions;
CREATE POLICY "Users can view own permissions" ON public.custom_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid()
  OR has_business_role(auth.uid(), business_id, ARRAY['owner','admin']));

-- customers
DROP POLICY IF EXISTS "Managers can manage customers" ON public.customers;
CREATE POLICY "Managers can manage customers" ON public.customers
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- error_logs
DROP POLICY IF EXISTS "Managers view error logs in their business" ON public.error_logs;
CREATE POLICY "Managers view error logs in their business" ON public.error_logs
FOR SELECT TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- goods_received_notes
DROP POLICY IF EXISTS "Managers can manage GRNs" ON public.goods_received_notes;
CREATE POLICY "Managers can manage GRNs" ON public.goods_received_notes
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- grn_items (via grn -> business)
DROP POLICY IF EXISTS "Managers can manage GRN items" ON public.grn_items;
CREATE POLICY "Managers can manage GRN items" ON public.grn_items
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id_from_grn(grn_id), ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id_from_grn(grn_id), ARRAY['owner','admin','manager']));

-- installment_plans
DROP POLICY IF EXISTS "Managers can manage installment plans" ON public.installment_plans;
CREATE POLICY "Managers can manage installment plans" ON public.installment_plans
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- legal_cases
DROP POLICY IF EXISTS "Managers can manage legal cases" ON public.legal_cases;
CREATE POLICY "Managers can manage legal cases" ON public.legal_cases
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- mpesa_callbacks
DROP POLICY IF EXISTS "Managers view mpesa callbacks in their business" ON public.mpesa_callbacks;
CREATE POLICY "Managers view mpesa callbacks in their business" ON public.mpesa_callbacks
FOR SELECT TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- parties
DROP POLICY IF EXISTS "Managers can manage parties" ON public.parties;
CREATE POLICY "Managers can manage parties" ON public.parties
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- payable_transactions
DROP POLICY IF EXISTS "Managers can manage payables" ON public.payable_transactions;
CREATE POLICY "Managers can manage payables" ON public.payable_transactions
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- payments (via sale -> business)
DROP POLICY IF EXISTS "Users can view payments for their sales or managers view all" ON public.payments;
CREATE POLICY "Users can view payments for their sales or managers view all" ON public.payments
FOR SELECT TO authenticated
USING (
  has_business_role(auth.uid(), business_id_from_sale(sale_id), ARRAY['owner','admin','manager'])
  OR EXISTS (SELECT 1 FROM sales WHERE sales.id = payments.sale_id AND sales.cashier_id = auth.uid())
);

-- perf_metrics
DROP POLICY IF EXISTS "Managers view perf metrics in their business" ON public.perf_metrics;
CREATE POLICY "Managers view perf metrics in their business" ON public.perf_metrics
FOR SELECT TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- printer_configurations
DROP POLICY IF EXISTS "Managers and above can manage printer configurations" ON public.printer_configurations;
CREATE POLICY "Managers and above can manage printer configurations" ON public.printer_configurations
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- products
DROP POLICY IF EXISTS "Managers and above can manage products" ON public.products;
CREATE POLICY "Managers and above can manage products" ON public.products
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- promotions
DROP POLICY IF EXISTS "Managers can manage promotions" ON public.promotions;
CREATE POLICY "Managers can manage promotions" ON public.promotions
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- purchase_order_items (via PO -> business)
DROP POLICY IF EXISTS "Managers can manage PO items" ON public.purchase_order_items;
CREATE POLICY "Managers can manage PO items" ON public.purchase_order_items
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id_from_po(purchase_order_id), ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id_from_po(purchase_order_id), ARRAY['owner','admin','manager']));

-- purchase_orders
DROP POLICY IF EXISTS "Managers can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Managers can manage purchase orders" ON public.purchase_orders
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- receipt_settings
DROP POLICY IF EXISTS "Managers and above can manage receipt settings" ON public.receipt_settings;
CREATE POLICY "Managers and above can manage receipt settings" ON public.receipt_settings
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- reorder_rules
DROP POLICY IF EXISTS "Managers can manage reorder rules" ON public.reorder_rules;
CREATE POLICY "Managers can manage reorder rules" ON public.reorder_rules
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- sale_items (via sale -> business)
DROP POLICY IF EXISTS "Users can view sale items for accessible sales" ON public.sale_items;
CREATE POLICY "Users can view sale items for accessible sales" ON public.sale_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND (sales.cashier_id = auth.uid()
        OR has_business_role(auth.uid(), sales.business_id, ARRAY['owner','admin','manager']))
  )
);

-- sales
DROP POLICY IF EXISTS "Managers and above can update sales" ON public.sales;
CREATE POLICY "Managers and above can update sales" ON public.sales
FOR UPDATE TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

DROP POLICY IF EXISTS "Users view sales in their business" ON public.sales;
CREATE POLICY "Users view sales in their business" ON public.sales
FOR SELECT TO authenticated
USING (
  business_id IS NOT NULL
  AND is_member_of_business(business_id)
  AND (cashier_id = auth.uid()
    OR has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
);

-- stock_movements
DROP POLICY IF EXISTS "Managers and above can create stock movements" ON public.stock_movements;
CREATE POLICY "Managers and above can create stock movements" ON public.stock_movements
FOR INSERT TO authenticated
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

DROP POLICY IF EXISTS "Managers and above can manage stock movements" ON public.stock_movements;
CREATE POLICY "Managers and above can manage stock movements" ON public.stock_movements
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- stock_transfers
DROP POLICY IF EXISTS "Managers and above can manage transfers" ON public.stock_transfers;
CREATE POLICY "Managers and above can manage transfers" ON public.stock_transfers
FOR ALL TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- sync_conflicts
DROP POLICY IF EXISTS "Managers resolve sync conflicts" ON public.sync_conflicts;
CREATE POLICY "Managers resolve sync conflicts" ON public.sync_conflicts
FOR UPDATE TO authenticated
USING (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']))
WITH CHECK (has_business_role(auth.uid(), business_id, ARRAY['owner','admin','manager']));

-- user_roles: this is the legacy PLATFORM-wide role table. Keep global has_role() here
-- since these roles are not business-scoped by design (super-admin escape hatch).
-- Left unchanged intentionally.
