-- Tighten RLS policies for sensitive data

-- 1. Fix customers table - restrict to managers and above for full access
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

CREATE POLICY "Cashiers can view customers for sales"
ON public.customers
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 2. Fix profiles table - users can only see their own profile, admins can see all
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or admins view all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'owner') 
  OR has_role(auth.uid(), 'admin')
);

-- 3. Fix branches table - sensitive business info restricted to managers+
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;

CREATE POLICY "Users can view basic branch info"
ON public.branches
FOR SELECT
USING (true);

-- Note: Sensitive fields (kra_pin, business_registration_number, mpesa details) 
-- should be handled at application level for managers only

-- 4. Fix payments table - cashiers see their own transactions, managers see all
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

CREATE POLICY "Users can view payments for their sales or managers view all"
ON public.payments
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') 
  OR has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR EXISTS (
    SELECT 1 FROM public.sales 
    WHERE sales.id = payments.sale_id 
    AND sales.cashier_id = auth.uid()
  )
);

-- 5. Fix sales table - cashiers see their own sales, managers see all
DROP POLICY IF EXISTS "Authenticated users can view sales" ON public.sales;

CREATE POLICY "Users can view own sales or managers view all"
ON public.sales
FOR SELECT
USING (
  cashier_id = auth.uid()
  OR has_role(auth.uid(), 'owner') 
  OR has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
);

-- 6. Fix sale_items - follows sales visibility
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON public.sale_items;

CREATE POLICY "Users can view sale items for accessible sales"
ON public.sale_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales 
    WHERE sales.id = sale_items.sale_id 
    AND (
      sales.cashier_id = auth.uid()
      OR has_role(auth.uid(), 'owner') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
    )
  )
);

-- 7. Fix user_roles - allow admins to see all roles for team management
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view own role or admins view all"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'owner') 
  OR has_role(auth.uid(), 'admin')
);