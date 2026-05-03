-- Drop the old complete_sale signature (without p_promotion_id) so PostgREST
-- can unambiguously route to the new one.
DROP FUNCTION IF EXISTS public.complete_sale(
  p_branch_id uuid,
  p_cashier_id uuid,
  p_receipt_number text,
  p_customer_id uuid,
  p_shift_id uuid,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_cost_total numeric,
  p_profit_total numeric,
  p_notes text,
  p_items jsonb,
  p_payments jsonb,
  p_offline_id text
);