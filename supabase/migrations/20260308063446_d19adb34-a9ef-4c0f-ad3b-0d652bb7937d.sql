
-- ============================================================
-- Purchase Orders & Goods Receiving Notes (Warehouse Module)
-- ============================================================

CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.parties(id),
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goods_received_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_number TEXT NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  supplier_id UUID REFERENCES public.parties(id),
  received_by UUID NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.grn_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.goods_received_notes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity_expected INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL,
  quantity_damaged INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Promotions & Price Engine
-- ============================================================

CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  promotion_type TEXT NOT NULL DEFAULT 'percentage_discount',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_purchase_amount NUMERIC,
  min_quantity INTEGER,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all',
  product_ids UUID[],
  category_ids UUID[],
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Reorder Rules (Smart Inventory)
-- ============================================================

CREATE TABLE public.reorder_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.parties(id),
  reorder_point INTEGER NOT NULL DEFAULT 10,
  reorder_quantity INTEGER NOT NULL DEFAULT 50,
  max_stock_level INTEGER,
  lead_time_days INTEGER NOT NULL DEFAULT 3,
  is_auto_reorder BOOLEAN NOT NULL DEFAULT false,
  last_reorder_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_rules ENABLE ROW LEVEL SECURITY;

-- Purchase Orders
CREATE POLICY "Auth users can view purchase orders" ON public.purchase_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage purchase orders" ON public.purchase_orders FOR ALL USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Purchase Order Items
CREATE POLICY "Auth users can view PO items" ON public.purchase_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage PO items" ON public.purchase_order_items FOR ALL USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- GRN
CREATE POLICY "Auth users can view GRNs" ON public.goods_received_notes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage GRNs" ON public.goods_received_notes FOR ALL USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- GRN Items
CREATE POLICY "Auth users can view GRN items" ON public.grn_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage GRN items" ON public.grn_items FOR ALL USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Promotions
CREATE POLICY "Auth users can view active promotions" ON public.promotions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage promotions" ON public.promotions FOR ALL USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Reorder Rules
CREATE POLICY "Auth users can view reorder rules" ON public.reorder_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage reorder rules" ON public.reorder_rules FOR ALL USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grn_updated_at BEFORE UPDATE ON public.goods_received_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reorder_rules_updated_at BEFORE UPDATE ON public.reorder_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
