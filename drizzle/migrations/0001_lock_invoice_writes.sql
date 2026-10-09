-- Invoices are only written through create_subscription_checkout or platform admins,
-- so owners cannot mark their own invoice as paid.
DROP POLICY IF EXISTS "Owners create invoices" ON public.subscription_invoices;
DROP POLICY IF EXISTS "Owners update invoices" ON public.subscription_invoices;
-- Owners also may not edit subscription status/periods directly.
DROP POLICY IF EXISTS "Owners manage subscription insert" ON public.business_subscriptions;
DROP POLICY IF EXISTS "Owners manage subscription update" ON public.business_subscriptions;