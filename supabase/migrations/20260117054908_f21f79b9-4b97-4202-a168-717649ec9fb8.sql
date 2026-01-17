-- Allow cashiers to record stock movements only for their own sales/returns

-- SALE movements: must reference a sale created by the cashier, and match the sale's branch
CREATE POLICY "Cashiers can record SALE stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND movement_type = 'SALE'
  AND quantity_change < 0
  AND created_by = auth.uid()
  AND reference_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.sales s
    JOIN public.branch_users bu
      ON bu.branch_id = s.branch_id
     AND bu.user_id = auth.uid()
    WHERE s.id = stock_movements.reference_id
      AND s.cashier_id = auth.uid()
      AND s.branch_id = stock_movements.branch_id
  )
);

-- RETURN movements: must reference a return processed by the cashier, and match the return's branch
CREATE POLICY "Cashiers can record RETURN stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND movement_type = 'RETURN'
  AND quantity_change > 0
  AND created_by = auth.uid()
  AND reference_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.returns r
    WHERE r.id = stock_movements.reference_id
      AND r.processed_by = auth.uid()
      AND r.branch_id = stock_movements.branch_id
  )
);
