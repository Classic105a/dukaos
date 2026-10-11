DROP POLICY IF EXISTS "Signed-in users read billing settings" ON public.platform_billing_settings;
CREATE POLICY "Business members and admins read billing settings" ON public.platform_billing_settings
  FOR SELECT TO authenticated USING (
    public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.user_id = auth.uid())
  );