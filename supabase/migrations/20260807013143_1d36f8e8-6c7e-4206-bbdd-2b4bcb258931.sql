
-- Platform admins can fully manage plans, subscriptions and invoices
CREATE POLICY "platform admins manage plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform admins manage subscriptions" ON public.business_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform admins manage invoices" ON public.subscription_invoices FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform admins manage redemptions" ON public.billing_promotion_redemptions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Audited billing action helper
CREATE OR REPLACE FUNCTION public.log_billing_action(
  p_business_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old jsonb DEFAULT NULL,
  p_new jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.billing_audit_log (business_id, actor_id, action, entity_type, entity_id, old_values, new_values, reason)
  VALUES (p_business_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_billing_action(uuid, text, text, uuid, jsonb, jsonb, text) TO authenticated;

-- Admin subscription lifecycle actions (all audited server-side)
CREATE OR REPLACE FUNCTION public.admin_subscription_action(
  p_business_id uuid,
  p_action text,
  p_days integer DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old public.business_subscriptions;
  v_new public.business_subscriptions;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_old FROM public.business_subscriptions WHERE business_id = p_business_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'No subscription for business %', p_business_id; END IF;

  IF p_action = 'extend_trial' THEN
    UPDATE public.business_subscriptions
       SET trial_ends_at = GREATEST(trial_ends_at, now()) + make_interval(days => COALESCE(p_days, 30)),
           status = 'trialing', updated_at = now()
     WHERE id = v_old.id RETURNING * INTO v_new;
  ELSIF p_action = 'free_months' THEN
    UPDATE public.business_subscriptions
       SET current_period_end = GREATEST(COALESCE(current_period_end, now()), now()) + make_interval(months => COALESCE(p_days, 1)),
           status = 'active', updated_at = now()
     WHERE id = v_old.id RETURNING * INTO v_new;
  ELSIF p_action = 'pause' THEN
    UPDATE public.business_subscriptions SET status = 'paused', auto_renew = false, updated_at = now()
     WHERE id = v_old.id RETURNING * INTO v_new;
  ELSIF p_action = 'resume' THEN
    UPDATE public.business_subscriptions SET status = 'active', auto_renew = true, updated_at = now()
     WHERE id = v_old.id RETURNING * INTO v_new;
  ELSIF p_action = 'cancel' THEN
    UPDATE public.business_subscriptions SET status = 'cancelled', auto_renew = false, cancelled_at = now(), updated_at = now()
     WHERE id = v_old.id RETURNING * INTO v_new;
  ELSIF p_action = 'change_plan' THEN
    IF p_plan_id IS NULL THEN RAISE EXCEPTION 'plan_id required'; END IF;
    UPDATE public.business_subscriptions SET plan_id = p_plan_id, updated_at = now()
     WHERE id = v_old.id RETURNING * INTO v_new;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  PERFORM public.log_billing_action(
    p_business_id, 'SUBSCRIPTION_' || upper(p_action), 'business_subscription', v_old.id,
    to_jsonb(v_old), to_jsonb(v_new), p_reason);

  RETURN to_jsonb(v_new);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_subscription_action(uuid, text, integer, uuid, text) TO authenticated;

-- Invoice write-off / regeneration status change (audited)
CREATE OR REPLACE FUNCTION public.admin_update_invoice_status(
  p_invoice_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.subscription_invoices; v_new public.subscription_invoices;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('draft','pending','paid','overdue','written_off','void') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', p_status;
  END IF;

  SELECT * INTO v_old FROM public.subscription_invoices WHERE id = p_invoice_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  UPDATE public.subscription_invoices
     SET status = p_status,
         paid_at = CASE WHEN p_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
         updated_at = now()
   WHERE id = p_invoice_id RETURNING * INTO v_new;

  PERFORM public.log_billing_action(v_old.business_id, 'INVOICE_STATUS_' || upper(p_status),
    'subscription_invoice', p_invoice_id, to_jsonb(v_old), to_jsonb(v_new), p_reason);

  RETURN to_jsonb(v_new);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_update_invoice_status(uuid, text, text) TO authenticated;
