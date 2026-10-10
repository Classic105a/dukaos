CREATE TABLE public.platform_billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  paybill_number text,
  account_label text NOT NULL DEFAULT 'Business name',
  instructions text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_billing_settings TO authenticated;
GRANT ALL ON public.platform_billing_settings TO service_role;
ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read billing settings" ON public.platform_billing_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins insert billing settings" ON public.platform_billing_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());
CREATE POLICY "Platform admins update billing settings" ON public.platform_billing_settings
  FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
INSERT INTO public.platform_billing_settings (id) VALUES (true) ON CONFLICT DO NOTHING;