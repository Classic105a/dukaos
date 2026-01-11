-- Tighten INSERT policies on transaction tables to validate ownership and branch access

-- 1. Drop existing overly permissive INSERT policies
DROP POLICY IF EXISTS "Authenticated users can create sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can create sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON public.payments;

-- 2. Create stricter INSERT policy for sales - validate cashier_id matches auth.uid()
-- and that user has access to the branch
CREATE POLICY "Users can create sales for their assigned branches"
ON public.sales
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND cashier_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.branch_users
    WHERE branch_users.branch_id = sales.branch_id
    AND branch_users.user_id = auth.uid()
  )
);

-- 3. Create stricter INSERT policy for sale_items - validate via sale ownership
CREATE POLICY "Users can create sale items for their sales"
ON public.sale_items
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
    AND sales.cashier_id = auth.uid()
  )
);

-- 4. Create stricter INSERT policy for payments - validate via sale ownership
CREATE POLICY "Users can create payments for their sales"
ON public.payments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = payments.sale_id
    AND sales.cashier_id = auth.uid()
  )
);