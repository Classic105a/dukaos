# DukaOS Hardening Roadmap
- [x] A Baseline (typecheck/lint/tests/build) — tsconfig/eslint config repaired; all green
- [x] B Money: complete_sale early idempotency, unique receipt/branch, unique completed M-Pesa ref, callback dedupe
- [x] C Inventory: atomic `process_return` (exactly-once, per-line caps, approval consumption), append-only ledger, PURCHASE type
- [x] D Security: anon EXECUTE revoked on SECURITY DEFINER fns, trigger fns locked, verify-manager business-scoped, branch-logo & user_roles tenant-scoped
- [x] E Offline: stable idempotency key per checkout, deterministic-failure fast-fail, conflict classification
- [x] F Cleanup: lint clean at `--max-warnings 0`; no dead-code deletions without reference proof
- [x] G Tests: `run_invariant_tests()` (13 DB checks) + existing Vitest suite
- [ ] H UX: stat card/modal shaking — deferred (no functional risk)
- [ ] Follow-ups (see docs/ARCHITECTURE_MIGRATION.md → Hardening pass → Remaining risks)
