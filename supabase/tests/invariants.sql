-- ============================================================================
-- DukaOS money / inventory / refund / tenancy invariant tests
--
-- Runs against a live database inside ONE transaction that is ALWAYS rolled
-- back, so it is safe to execute against any environment. Every fixture row
-- (users, business, branch, products, stock) is created and discarded here.
--
-- Run:  psql -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
-- A failing assertion raises an exception -> non-zero exit code.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DO $test$
DECLARE
  -- fixtures
  u_manager uuid := gen_random_uuid();
  u_cashier uuid := gen_random_uuid();
  u_outsider uuid := gen_random_uuid();
  biz_a uuid; biz_b uuid;
  br_a uuid; br_b uuid;
  prod_a uuid; prod_a2 uuid; prod_b uuid;
  cust_a uuid;
  -- working
  r jsonb; r2 jsonb;
  sale_id uuid; sale2_id uuid; ret_id uuid;
  si_id uuid; si2_id uuid;
  approval_id uuid;
  n int; q int; q0 int; amt numeric;
  key1 text := 'test-offline-' || gen_random_uuid()::text;
  rkey text := 'test-return-' || gen_random_uuid()::text;
  failed boolean;
  msg text;

  PROCEDURE_AS_USER CONSTANT text := '';
BEGIN
  ------------------------------------------------------------------ fixtures
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         x.id::text || '@invariants.test', 'x', now(), '{"provider":"email"}', '{}', now(), now()
  FROM (VALUES (u_manager), (u_cashier), (u_outsider)) AS x(id);

  INSERT INTO public.businesses (name, type, created_by, industry) VALUES ('INV Biz A', 'retail', u_manager, 'retail') RETURNING id INTO biz_a;
  INSERT INTO public.businesses (name, type, created_by, industry) VALUES ('INV Biz B', 'retail', u_outsider, 'retail') RETURNING id INTO biz_b;

  INSERT INTO public.business_users (business_id, user_id, role, is_owner, status) VALUES
    (biz_a, u_manager, 'manager', false, 'active'),
    (biz_a, u_cashier, 'cashier', false, 'active'),
    (biz_b, u_outsider, 'owner', true, 'active');

  INSERT INTO public.branches (name, business_id, default_tax_rate, receipt_prefix) VALUES ('INV Branch A', biz_a, 16, 'TSTA') RETURNING id INTO br_a;
  INSERT INTO public.branches (name, business_id, default_tax_rate, receipt_prefix) VALUES ('INV Branch B', biz_b, 16, 'TSTB') RETURNING id INTO br_b;

  INSERT INTO public.branch_users (branch_id, user_id) VALUES (br_a, u_manager), (br_a, u_cashier), (br_b, u_outsider);

  INSERT INTO public.products (name, unit_price, cost_price, business_id, branch_id, is_active, track_inventory)
    VALUES ('INV Soda', 100, 60, biz_a, br_a, true, true) RETURNING id INTO prod_a;
  INSERT INTO public.products (name, unit_price, cost_price, business_id, branch_id, is_active, track_inventory)
    VALUES ('INV Bread', 50, 30, biz_a, br_a, true, true) RETURNING id INTO prod_a2;
  INSERT INTO public.products (name, unit_price, cost_price, business_id, branch_id, is_active, track_inventory)
    VALUES ('INV Foreign', 10, 5, biz_b, br_b, true, false) RETURNING id INTO prod_b;

  INSERT INTO public.current_stock (product_id, branch_id, quantity, business_id) VALUES
    (prod_a, br_a, 5, biz_a), (prod_a2, br_a, 5, biz_a);

  INSERT INTO public.customers (name, business_id) VALUES ('INV Customer', biz_a) RETURNING id INTO cust_a;

  ---------------------------------------------------------------- helpers
  -- act as cashier
  PERFORM set_config('request.jwt.claim.sub', u_cashier::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_cashier, 'role', 'authenticated')::text, true);

  ------------------------------------------------------- 1. successful sale
  r := public.complete_sale(br_a, u_cashier, NULL, cust_a, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 2),
                          jsonb_build_object('product_id', prod_a2, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','cash','amount', 300)),
        key1, NULL);
  sale_id := (r->>'sale_id')::uuid;
  IF r->>'status' <> 'completed' THEN RAISE EXCEPTION 'FAIL 1: status %', r; END IF;
  IF (r->>'server_total')::numeric <> 250 THEN RAISE EXCEPTION 'FAIL 1: server total % (expected 250)', r->>'server_total'; END IF;
  IF (r->>'change')::numeric <> 50 THEN RAISE EXCEPTION 'FAIL 1: change % (expected 50)', r->>'change'; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 3 THEN RAISE EXCEPTION 'FAIL 1: stock % (expected 3)', q; END IF;
  SELECT count(*) INTO n FROM public.payments WHERE sale_id = sale_id; -- note: column = variable name guard below
  SELECT count(*) INTO n FROM public.payments p WHERE p.sale_id = (r->>'sale_id')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 1: payments %', n; END IF;
  SELECT count(*) INTO n FROM public.stock_movements sm WHERE sm.reference_id = sale_id AND sm.movement_type = 'SALE';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL 1: movements %', n; END IF;
  SELECT count(*) INTO n FROM public.audit_logs a WHERE a.entity_id = sale_id AND a.action = 'SALE_COMPLETED';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 1: audit %', n; END IF;
  RAISE NOTICE 'ok 1 - complete_sale creates sale, items, payment, ledger, audit; deducts stock once';

  ------------------------------------- 2. duplicate transaction (same key)
  SELECT count(*) INTO n FROM public.sales s WHERE s.business_id = biz_a;
  r2 := public.complete_sale(br_a, u_cashier, NULL, cust_a, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 2),
                          jsonb_build_object('product_id', prod_a2, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','cash','amount', 300)),
        key1, NULL);
  IF r2->>'status' <> 'already_synced' OR (r2->>'sale_id')::uuid <> sale_id THEN RAISE EXCEPTION 'FAIL 2: %', r2; END IF;
  IF r2->>'receipt_number' <> r->>'receipt_number' THEN RAISE EXCEPTION 'FAIL 2: receipt mismatch'; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 3 THEN RAISE EXCEPTION 'FAIL 2: stock deducted twice (%)', q; END IF;
  IF (SELECT count(*) FROM public.sales s WHERE s.business_id = biz_a) <> n THEN RAISE EXCEPTION 'FAIL 2: duplicate sale created'; END IF;
  RAISE NOTICE 'ok 2 - replaying the same transaction id is idempotent (no 2nd sale, no 2nd deduction)';

  ------------------------------------------------- 3. insufficient stock
  failed := false;
  BEGIN
    PERFORM public.complete_sale(br_a, u_cashier, NULL, NULL, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 4)),
        jsonb_build_array(jsonb_build_object('payment_method','cash','amount', 400)), NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed OR msg NOT ILIKE '%Insufficient stock%' THEN RAISE EXCEPTION 'FAIL 3: oversell allowed (%)', msg; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 3 THEN RAISE EXCEPTION 'FAIL 3: stock changed on failed sale (%)', q; END IF;
  RAISE NOTICE 'ok 3 - oversell rejected atomically, stock untouched';

  ----------------------------------------------- 4. cross-tenant product
  failed := false;
  BEGIN
    PERFORM public.complete_sale(br_a, u_cashier, NULL, NULL, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_b, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','cash','amount', 10)), NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 4: sold another business''s product'; END IF;
  RAISE NOTICE 'ok 4 - products from another business cannot be sold';

  ------------------------------------------- 5. duplicate receipt number
  failed := false;
  BEGIN
    PERFORM public.complete_sale(br_a, u_cashier, r->>'receipt_number', NULL, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','cash','amount', 100)), NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 5: duplicate receipt accepted'; END IF;
  RAISE NOTICE 'ok 5 - receipt numbers are unique per branch (%)', msg;

  ------------------------------------------- 6. M-Pesa code reuse blocked
  r2 := public.complete_sale(br_a, u_cashier, NULL, NULL, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a2, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','mpesa','amount', 50, 'mpesa_reference','TESTREF1')), NULL, NULL);
  sale2_id := (r2->>'sale_id')::uuid;
  failed := false;
  BEGIN
    PERFORM public.complete_sale(br_a, u_cashier, NULL, NULL, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a2, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','mpesa','amount', 50, 'mpesa_reference','TESTREF1')), NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed OR msg NOT ILIKE '%M-Pesa code%' THEN RAISE EXCEPTION 'FAIL 6: mpesa ref reused (%)', msg; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a2 AND branch_id = br_a;
  IF q <> 3 THEN RAISE EXCEPTION 'FAIL 6: stock wrong after rejected sale (%)', q; END IF;
  RAISE NOTICE 'ok 6 - one M-Pesa confirmation code settles at most one sale';

  ---------------------------------------- 7. cashier refund needs approval
  SELECT id INTO si_id FROM public.sale_items WHERE sale_items.sale_id = sale_id AND product_id = prod_a;
  SELECT id INTO si2_id FROM public.sale_items WHERE sale_items.sale_id = sale_id AND product_id = prod_a2;
  failed := false;
  BEGIN
    PERFORM public.process_return(sale_id, jsonb_build_array(jsonb_build_object('sale_item_id', si_id, 'quantity', 1)), 'test', 'cash', NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed OR msg NOT ILIKE '%approval%' THEN RAISE EXCEPTION 'FAIL 7: cashier refunded without approval (%)', msg; END IF;
  RAISE NOTICE 'ok 7 - cashier cannot refund without manager approval';

  ------------------------------- 8. cashier with single-use approval
  INSERT INTO public.approval_requests (request_type, requested_by, approved_by, branch_id, entity_type, entity_id, status, resolved_at)
  VALUES ('REFUND', u_cashier, u_manager, br_a, 'refund', sale_id, 'approved', now()) RETURNING id INTO approval_id;
  r2 := public.process_return(sale_id, jsonb_build_array(jsonb_build_object('sale_item_id', si_id, 'quantity', 1)), 'damaged', 'cash', rkey, approval_id);
  ret_id := (r2->>'return_id')::uuid;
  IF (r2->>'refund_amount')::numeric <> 100 THEN RAISE EXCEPTION 'FAIL 8: refund amount % (expected 100)', r2->>'refund_amount'; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 4 THEN RAISE EXCEPTION 'FAIL 8: stock not restored (%)', q; END IF;
  IF (SELECT status FROM public.approval_requests WHERE id = approval_id) <> 'consumed' THEN RAISE EXCEPTION 'FAIL 8: approval not consumed'; END IF;
  IF (SELECT count(*) FROM public.return_items WHERE return_id = ret_id) <> 1 THEN RAISE EXCEPTION 'FAIL 8: return_items missing'; END IF;
  IF (SELECT count(*) FROM public.audit_logs WHERE entity_id = ret_id AND action = 'REFUND_PROCESSED') <> 1 THEN RAISE EXCEPTION 'FAIL 8: audit missing'; END IF;
  RAISE NOTICE 'ok 8 - approved refund restores stock exactly once, consumes approval, audited';

  -- 8b. approval cannot be reused
  failed := false;
  BEGIN
    PERFORM public.process_return(sale_id, jsonb_build_array(jsonb_build_object('sale_item_id', si_id, 'quantity', 1)), 'again', 'cash', NULL, approval_id);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 8b: approval reused'; END IF;
  RAISE NOTICE 'ok 8b - a consumed approval cannot be reused';

  ------------------------------------------- 9. duplicate refund replay
  r2 := public.process_return(sale_id, jsonb_build_array(jsonb_build_object('sale_item_id', si_id, 'quantity', 1)), 'damaged', 'cash', rkey, NULL);
  IF r2->>'status' <> 'already_processed' OR (r2->>'return_id')::uuid <> ret_id THEN RAISE EXCEPTION 'FAIL 9: %', r2; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 4 THEN RAISE EXCEPTION 'FAIL 9: stock restored twice (%)', q; END IF;
  RAISE NOTICE 'ok 9 - replaying a refund is idempotent (stock restored once)';

  ------------------------------------------------- 10. over-refund (manager)
  PERFORM set_config('request.jwt.claim.sub', u_manager::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_manager, 'role', 'authenticated')::text, true);
  failed := false;
  BEGIN
    PERFORM public.process_return(sale_id, jsonb_build_array(jsonb_build_object('sale_item_id', si_id, 'quantity', 2)), 'too many', 'cash', NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; msg := SQLERRM; END;
  IF NOT failed OR msg NOT ILIKE '%exceeds%' THEN RAISE EXCEPTION 'FAIL 10: over-refund allowed (%)', msg; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 4 THEN RAISE EXCEPTION 'FAIL 10: stock changed on rejected refund (%)', q; END IF;
  RAISE NOTICE 'ok 10 - cannot refund more than was sold (sold 2, already returned 1)';

  -- 10b. manager partial refund of remaining, then full sale refunded exactly
  r2 := public.process_return(sale_id, jsonb_build_array(jsonb_build_object('sale_item_id', si_id, 'quantity', 1),
                                                         jsonb_build_object('sale_item_id', si2_id, 'quantity', 1)), 'rest', 'cash', NULL, NULL);
  SELECT COALESCE(sum(refund_amount),0) INTO amt FROM public.returns WHERE original_sale_id = sale_id;
  IF amt <> 250 THEN RAISE EXCEPTION 'FAIL 10b: total refunded % (expected 250)', amt; END IF;
  SELECT quantity INTO q FROM public.current_stock WHERE product_id = prod_a AND branch_id = br_a;
  IF q <> 5 THEN RAISE EXCEPTION 'FAIL 10b: stock % (expected 5)', q; END IF;
  RAISE NOTICE 'ok 10b - refunds sum exactly to the sale total; stock fully restored';

  ------------------------------------------------- 11. tenant isolation (RLS)
  PERFORM set_config('request.jwt.claim.sub', u_outsider::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_outsider, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF (SELECT count(*) FROM public.products WHERE business_id = biz_a) <> 0 THEN RAISE EXCEPTION 'FAIL 11: outsider sees products'; END IF;
  IF (SELECT count(*) FROM public.sales WHERE business_id = biz_a) <> 0 THEN RAISE EXCEPTION 'FAIL 11: outsider sees sales'; END IF;
  IF (SELECT count(*) FROM public.customers WHERE business_id = biz_a) <> 0 THEN RAISE EXCEPTION 'FAIL 11: outsider sees customers'; END IF;
  IF (SELECT count(*) FROM public.current_stock WHERE business_id = biz_a) <> 0 THEN RAISE EXCEPTION 'FAIL 11: outsider sees stock'; END IF;
  IF (SELECT count(*) FROM public.returns WHERE business_id = biz_a) <> 0 THEN RAISE EXCEPTION 'FAIL 11: outsider sees returns'; END IF;
  IF (SELECT count(*) FROM public.stock_movements WHERE business_id = biz_a) <> 0 THEN RAISE EXCEPTION 'FAIL 11: outsider sees movements'; END IF;
  -- RPC path: outsider cannot refund or sell in business A
  failed := false;
  BEGIN
    PERFORM public.process_return(sale2_id, jsonb_build_array(jsonb_build_object('sale_item_id', si2_id, 'quantity', 1)), 'x', 'cash', NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 11: outsider refunded via RPC'; END IF;
  failed := false;
  BEGIN
    PERFORM public.complete_sale(br_a, u_outsider, NULL, NULL, NULL, 0,0,0,0,0,0, NULL,
        jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        jsonb_build_array(jsonb_build_object('payment_method','cash','amount', 100)), NULL, NULL);
  EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 11: outsider sold via RPC'; END IF;
  -- cashier cannot write refund rows / ledger rows directly (must use RPC)
  PERFORM set_config('request.jwt.claim.sub', u_cashier::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_cashier, 'role', 'authenticated')::text, true);
  failed := false;
  BEGIN
    INSERT INTO public.returns (original_sale_id, branch_id, business_id, processed_by, reason, refund_method, refund_amount, status)
    VALUES (sale2_id, br_a, biz_a, u_cashier, 'direct', 'cash', 50, 'completed');
  EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 11: cashier inserted return directly'; END IF;
  failed := false;
  BEGIN
    INSERT INTO public.stock_movements (product_id, branch_id, business_id, quantity_change, movement_type, created_by)
    VALUES (prod_a, br_a, biz_a, 100, 'RETURN', u_cashier);
  EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL 11: cashier inflated stock directly'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'ok 11 - tenant isolation holds for tables and RPCs; ledger/refunds not directly writable by cashiers';

  RAISE NOTICE 'ALL INVARIANT TESTS PASSED';
END
$test$;

ROLLBACK;
