-- Drop the SECURITY DEFINER view that was flagged
DROP VIEW IF EXISTS public.current_stock;

-- Create a SECURITY INVOKER version (safe - uses caller's permissions)
CREATE OR REPLACE VIEW public.current_stock 
WITH (security_invoker = true)
AS
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