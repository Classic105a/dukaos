-- ============================================================================
-- DukaOS money / inventory / refund / tenancy invariant tests
--
-- The scenarios live in the database function public.run_invariant_tests()
-- (see migration "invariant test harness"). It creates throw-away fixtures,
-- exercises complete_sale / process_return / RLS, and ALWAYS rolls its work
-- back, so it is safe to run against any environment.
--
-- Run:  psql -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
-- Output ends with "PASS: N checks passed" or "FAIL: <first failing check>".
-- ============================================================================
\set ON_ERROR_STOP on
SELECT public.run_invariant_tests() AS result \gset
\echo :result
SELECT CASE WHEN :'result' LIKE 'PASS%' THEN 0 ELSE 1 END AS exit_code \gset
\if :exit_code
  \warn Invariant tests failed
  \quit 1
\endif
