-- Owner/admin starts a plan purchase: server prices it and records a pending invoice.
CREATE OR REPLACE FUNCTION public.create_subscription_checkout(
  p_business_id uuid, p_plan_id uuid, p_cycle text, p_coupon text,
  p_method text, p_reference text, p_phone text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote jsonb; v_amount numeric(12,2); v_sub public.business_subscriptions;
  v_inv public.subscription_invoices; v_start timestamptz; v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_business_owner(p_business_id) OR public.has_business_role(auth.uid(), p_business_id, ARRAY['owner','admin'])) THEN
    RAISE EXCEPTION 'Only the business owner can change the plan';
  END IF;
  IF p_cycle NOT IN ('monthly','yearly') THEN RAISE EXCEPTION 'Invalid billing cycle'; END IF;
  IF p_method NOT IN ('mpesa_paybill','bank','cash') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id AND is_active) THEN RAISE EXCEPTION 'Plan not found'; END IF;

  SELECT * INTO v_sub FROM public.business_subscriptions WHERE business_id = p_business_id FOR UPDATE;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'No subscription for this business'; END IF;

  v_quote := public.calculate_subscription_price(p_business_id, p_plan_id, p_cycle, NULLIF(trim(p_coupon),''));
  v_amount := COALESCE((v_quote->>'final_amount')::numeric, 0);

  IF v_amount > 0 AND (p_reference IS NULL OR length(trim(p_reference)) < 6 OR length(p_reference) > 40) THEN
    RAISE EXCEPTION 'Enter the payment confirmation code';
  END IF;
  IF v_amount > 0 AND EXISTS (SELECT 1 FROM public.subscription_invoices WHERE upper(payment_reference) = upper(trim(p_reference))) THEN
    RAISE EXCEPTION 'This payment code has already been used';
  END IF;

  v_start := GREATEST(COALESCE(v_sub.current_period_end, now()), now());
  v_end := v_start + CASE WHEN p_cycle = 'yearly' THEN interval '1 year' ELSE interval '1 month' END;

  INSERT INTO public.subscription_invoices (business_id, subscription_id, invoice_number, amount, currency, status,
    billing_cycle, period_start, period_end, due_date, payment_method, payment_reference, paid_at)
  VALUES (p_business_id, v_sub.id,
    'SUB-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text),1,6)),
    v_amount, COALESCE(v_quote->>'currency','KES'),
    CASE WHEN v_amount = 0 THEN 'paid' ELSE 'pending' END,
    p_cycle, v_start, v_end, current_date, p_method, NULLIF(upper(trim(p_reference)),''),
    CASE WHEN v_amount = 0 THEN now() END)
  RETURNING * INTO v_inv;

  -- Store the requested plan on the invoice for activation
  UPDATE public.subscription_invoices SET notes = p_plan_id::text WHERE id = v_inv.id;

  PERFORM public.log_billing_action(p_business_id, 'CHECKOUT_CREATED', 'subscription_invoice', v_inv.id, NULL,
    jsonb_build_object('plan_id', p_plan_id, 'cycle', p_cycle, 'amount', v_amount, 'phone', p_phone), NULL);

  RETURN jsonb_build_object('invoice_id', v_inv.id, 'invoice_number', v_inv.invoice_number,
    'amount', v_amount, 'status', CASE WHEN v_amount = 0 THEN 'paid' ELSE 'pending' END);
END $$;

ALTER TABLE public.subscription_invoices ADD COLUMN IF NOT EXISTS notes text;

-- When an invoice becomes paid, activate the subscription for the paid period.
CREATE OR REPLACE FUNCTION public.activate_subscription_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan uuid;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') AND NEW.subscription_id IS NOT NULL THEN
    BEGIN v_plan := NULLIF(NEW.notes,'')::uuid; EXCEPTION WHEN others THEN v_plan := NULL; END;
    UPDATE public.business_subscriptions
       SET status = 'active',
           plan_id = COALESCE(v_plan, plan_id),
           billing_cycle = NEW.billing_cycle,
           current_period_start = COALESCE(NEW.period_start, now()),
           current_period_end = GREATEST(COALESCE(current_period_end, now()), COALESCE(NEW.period_end, now() + interval '1 month')),
           grace_period_ends_at = NULL, cancelled_at = NULL, updated_at = now()
     WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activate_subscription_on_paid ON public.subscription_invoices;
CREATE TRIGGER trg_activate_subscription_on_paid
  AFTER INSERT OR UPDATE OF status ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.activate_subscription_on_paid();

-- Plan limits enforced server-side for branches and products.
CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limit integer; v_used integer;
BEGIN
  IF NEW.business_id IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'branches' THEN
    SELECT p.max_branches INTO v_limit FROM public.business_subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.business_id = NEW.business_id;
    SELECT count(*) INTO v_used FROM public.branches WHERE business_id = NEW.business_id AND is_active;
  ELSE
    SELECT p.max_products INTO v_limit FROM public.business_subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.business_id = NEW.business_id;
    SELECT count(*) INTO v_used FROM public.products WHERE business_id = NEW.business_id AND is_active;
  END IF;
  IF v_limit IS NOT NULL AND v_used >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT: Your plan allows % %. Upgrade to add more.', v_limit, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_branches_plan_limit ON public.branches;
CREATE TRIGGER trg_branches_plan_limit BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
DROP TRIGGER IF EXISTS trg_products_plan_limit ON public.products;
CREATE TRIGGER trg_products_plan_limit BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

REVOKE EXECUTE ON FUNCTION public.create_subscription_checkout(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subscription_checkout(uuid,uuid,text,text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_subscription_on_paid() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_limit() FROM PUBLIC, anon;