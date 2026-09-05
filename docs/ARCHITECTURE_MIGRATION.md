# DukaOS Architecture Migration Log

Running record of the enterprise refactor. Update this file at the end of every pass.

---

## Pass 1 — Navigation shell (done)

**Changed**
- Added `src/components/layout/AppSidebar.tsx`: single grouped, feature-flag-aware navigation. Collapsible icon rail on desktop, drawer on mobile.
- Removed `BottomNav` entirely; `DashboardLayout` and the POS screen now share `SidebarProvider`.
- Fixed horizontal overflow on Inventory (internally scrolling action bar and tab strip).

**Verified** — `scrollWidth === 360` on `/dashboard` and `/inventory`; typecheck clean.

---

## Pass 2 — Design system + Business Command Center (done)

**Global design system** — `src/components/ds/`
| Primitive | File | Purpose |
| --- | --- | --- |
| `Surface`, `SurfaceHeader` | `Surface.tsx` | Canonical card system (tone / elevation / padding / interactive). Replaces ad-hoc `bg-card border rounded-*`. |
| `StatusBadge`, `statusTone()` | `StatusBadge.tsx` | One status vocabulary (neutral / primary / success / warning / danger / info) + domain-status mapper. |
| `PageShell` | `PageShell.tsx` | Mandatory page layout: title → context actions → search → filters → content → secondary actions → status. |
| `SearchBar`, `FilterBar`, `FilterChip` | `Controls.tsx` | Standard search and filter chrome; overflow-safe on 360px. |
| `StatCard` | `StatCard.tsx` | Secondary-priority KPI tile with delta indicator. |
| `SkeletonBlock`, `WidgetSkeleton`, `StatSkeleton`, `ListSkeleton`, `ChartSkeleton` | `Skeletons.tsx` | Skeleton loading system — spinners are no longer the default. |
| `InlineEmpty`, `ErrorState` | `States.tsx` | Canonical empty and error states with retry. |
| `money()`, `percentDelta()` | `format.ts` | Single money formatter (KES, compact mode). |

Colors, typography, spacing and animation continue to come from `src/index.css` tokens and `tailwind.config.ts`; no hardcoded color utilities were introduced.

**Business Command Center** — `src/pages/CommandCenter.tsx` (route `/command-center`)
Answers "what requires my attention today?" — alerts and pending work first, KPIs last.

Widgets (`src/components/dashboard/widgets.tsx`, shared shell in `Widget.tsx`):
critical alerts · quick actions · pending approvals · pending stock transfers · supplier invoices due ·
low stock · slow-moving inventory · best sellers · revenue trend (14d) · cash flow by payment method ·
branch comparison · staff on shift · system health · recent activity timeline · today's KPI strip
(revenue, profit, transactions, average basket).

**Data layer** — `src/hooks/useCommandCenter.tsx`
- 100% read-only. No business logic, payments, inventory or receipt code touched.
- Every query is tenant-scoped by `business_id` (and `branch_id` where branch-local).
- react-query caching (`staleTime` 60s, `gcTime` 5m) with a shared `['cc', …]` key namespace; a single "Refresh" invalidates the namespace.
- One 14-day sales window feeds revenue trend, today's profit, branch comparison and the KPI strip via a memoised aggregator — no duplicate requests.
- Independent queries are issued in parallel (`Promise.all` inside the action-queue query); widgets render skeletons independently and never block each other.
- Widgets are `memo()`-ised; the Command Center route is lazy-loaded via `React.lazy`.

**Navigation** — new "Overview" group with Command Center; the former `/analytics` entry is now labelled "Analytics" under Sales.

**Verified** — typecheck clean; `/command-center` renders at 360px with `scrollWidth === 360` (no horizontal scroll); no new console errors.

---

## Known technical debt

---

## Pass 3a — Shared data surface + global command palette (done)

**New design-system primitives**
| Primitive | File | Purpose |
| --- | --- | --- |
| `DataTable` | `src/components/ds/DataTable.tsx` | Canonical table: sticky header, optional sticky first column, client-side sorting, checkbox selection + bulk-action bar, skeleton/empty states, and an automatic card layout under `md` (no horizontal scrolling on 360px). |
| `useDebouncedValue` | `src/hooks/useDebouncedValue.ts` | Shared debounce for search inputs and filters (kills redundant queries). |

Modules must now render lists through `DataTable` instead of hand-rolled `<table>` markup.

**Global command palette**
- `src/components/command/CommandPalette.tsx` + `src/hooks/useCommandPalette.tsx`.
- `Ctrl/Cmd + K` anywhere inside the authenticated shell; a `Search…` button in the app bar is the mobile entry point.
- Fuzzy navigation across every feature-flagged module, plus debounced tenant-scoped search of products, customers and suppliers (react-query cached, 30s staleTime, only fires at ≥2 characters).
- Recently visited destinations persist in `localStorage` (`dukaos:recent-routes`).
- Provider is mounted inside `ProtectedRoute`, so it sits under Business/Branch context and is unavailable when signed out.

**Security (backend)**
- `business_users` self-insert policy no longer allows self-assigned elevated roles — self-inserts are limited to non-owner, staff-level, `pending` rows; elevated roles must come through the invite RPCs.
- `dr-backups` storage reads are now business-scoped via `has_business_role(auth.uid(), <business_id from object path>, ARRAY['owner','admin'])` instead of the global `has_role` check.

**Next implementation target (Pass 3b)** — migrate `Inventory` and `Reports` list surfaces onto `DataTable`, add the product quick-edit drawer and preview side panel, then continue into Pass 4 (Customers & CRM).

- Legacy pages (Inventory, Reports, Customers, Warehouse, Settings, Analytics) still use bespoke headers and cards; they must be migrated to `PageShell` + `Surface` + `StatusBadge`.
- Two toast systems are mounted (`@/components/ui/toaster` legacy + sonner). New code uses **sonner only**; the legacy toaster stays until remaining call sites are migrated.
- "Employee attendance" is derived from `cashier_shifts`; a real HR/attendance module is not implemented.
- Slow-moving detection uses `current_stock.last_movement_at` as a proxy rather than a sales-velocity calculation.
- Approvals widget is branch-scoped because `approval_requests` has no `business_id` column.
- `Analytics` page overlaps the Command Center in places; it should become the deep-dive reporting surface only.

---

## Next implementation target

**Pass 3 — Module redesign on the design system**
1. Migrate Inventory to `PageShell` + `Surface` + shared table component (extract `DataTable` into `src/components/ds/`).
2. Migrate Reports / Sales History to the same shell; unify filter chips with `FilterChip`.
3. Extract a shared `FormSection`/`FormField` primitive and standardise dialogs and drawers.
4. Retire the legacy toaster once all call sites use sonner.
5. Optimistic updates for inventory stock edits and customer mutations.
## Production hardening pass (done)

Scope: money safety, inventory integrity, M-Pesa, offline sync, tenant security. No rewrites; new migrations only.

### Changed
- `complete_sale`: idempotency check runs **before** any stock work (same `p_offline_id` → same sale, no second deduction); business-scoped product validation; quantity/payment/shift validation; friendly errors for duplicate receipt and reused M-Pesa code.
- `process_return` (new RPC): atomic full/partial refunds, per-line "sold minus already returned" caps, refund ≤ paid, single-use 15-minute manager approvals for cashiers, `return_items` ledger, audit row. Client `ReturnModal` now calls it instead of writing `returns`/`stock_movements` directly.
- Unique indexes: `(branch_id, receipt_number)`, completed M-Pesa `payments.mpesa_reference`.
- `stock_movements` is append-only for clients; RETURN/SALE rows are only written by RPCs.
- `verify-manager` edge function: requires `business_id`, checks caller membership, validates PIN/password against that business's managers, issues a bound approval, audits the override.
- `mpesa-callback`: reconciles by CheckoutRequestID **or** receipt code; duplicate callbacks acknowledged without regressing state.
- Online POS checkout now sends a stable UUID as `p_offline_id` (retry-safe); offline sync fails fast on deterministic errors and records `sync_conflicts`.
- Storage: `branch-logos` writes scoped to the branch's business. `user_roles` reads/writes scoped to same-business owners/admins (or platform admins).
- CSV export neutralises spreadsheet formula injection.
- Tooling: `tsconfig.app.json` and `eslint.config.js` repaired; lint passes at `--max-warnings 0`.

### Added
- `public.run_invariant_tests()` — 13 rolled-back DB checks (sale creation, idempotent replay, oversell, cross-tenant product, duplicate receipt, M-Pesa reuse, cashier approval gate, approval consumption, refund replay, over-refund, exact refund totals, RLS/RPC isolation). Runner: `supabase/tests/invariants.sql` (needs a role that can `SET ROLE authenticated`, e.g. postgres/service role).

### Preserved
Auth, business switching, RLS helpers, receipt numbering, audit hash chain, invites, subscriptions, offline architecture, all client flows.

### Remaining risks / follow-ups
- `usePermissions` still reads the global `user_roles` table for UI gating; the database enforces `business_users` roles. Align the UI hook to the current business's `business_users` role (behavioural change — confirm with product first).
- Security linter warnings (informational): 23 SECURITY DEFINER helpers callable by signed-in users (required by RLS/app), `pg_trgm`/`pgcrypto` in `public`, one mutable search_path on an extension function, `plan_prices` readable by anon (pricing page).
- M-Pesa STK push initiation is not implemented (manual code entry only); callback endpoint is ready for it.
- Sale voids for completed sales still go through client code paths; consider a `void_sale` RPC mirroring `process_return`.
