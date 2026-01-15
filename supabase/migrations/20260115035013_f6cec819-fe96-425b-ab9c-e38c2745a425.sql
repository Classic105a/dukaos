-- Add branch_id and is_shared_product to products table for branch-independent products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS is_shared_product boolean NOT NULL DEFAULT false;

-- Create index for branch-based product queries
CREATE INDEX IF NOT EXISTS idx_products_branch_id ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_shared ON public.products(is_shared_product) WHERE is_shared_product = true;

-- Create stock_movements table for full audit trail
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity_change integer NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('ADD', 'SALE', 'ADJUSTMENT', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'INITIAL')),
  batch_number text,
  expiry_date date,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for stock_movements
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_branch ON public.stock_movements(branch_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_type ON public.stock_movements(movement_type);

-- Enable RLS on stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_movements
CREATE POLICY "Authenticated users can view stock movements"
ON public.stock_movements
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and above can create stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers and above can manage stock movements"
ON public.stock_movements
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create a function to get current stock for a product at a branch (calculated from movements)
CREATE OR REPLACE FUNCTION public.get_product_stock(p_product_id uuid, p_branch_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity_change), 0)::integer
  FROM public.stock_movements
  WHERE product_id = p_product_id
    AND branch_id = p_branch_id
$$;

-- Create a view for current stock levels (aggregated from movements)
CREATE OR REPLACE VIEW public.current_stock AS
SELECT 
  sm.product_id,
  sm.branch_id,
  SUM(sm.quantity_change)::integer as quantity,
  MAX(sm.created_at) as last_movement_at,
  (SELECT batch_number FROM public.stock_movements 
   WHERE product_id = sm.product_id AND branch_id = sm.branch_id 
   AND batch_number IS NOT NULL 
   ORDER BY created_at DESC LIMIT 1) as latest_batch_number,
  (SELECT expiry_date FROM public.stock_movements 
   WHERE product_id = sm.product_id AND branch_id = sm.branch_id 
   AND expiry_date IS NOT NULL 
   ORDER BY created_at DESC LIMIT 1) as latest_expiry_date
FROM public.stock_movements sm
GROUP BY sm.product_id, sm.branch_id;

-- Update products RLS to include branch filtering
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;

CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
USING (
  -- User can see products that are shared
  is_shared_product = true 
  OR 
  -- Or products belonging to their current branch (they can view any branch's products for now)
  branch_id IS NOT NULL
  OR
  -- Or products with no branch (legacy/global products)
  branch_id IS NULL
);