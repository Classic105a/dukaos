
## DukaOS Production Hardening Plan

### Current State Assessment
- **Multi-tenancy**: Only 8 of ~25 tables have `business_id`. Critical tables like `categories`, `customers`, `products`, `sales`, `payments`, `stock_movements` lack tenant isolation — **this is a data leakage risk**.
- **Money precision**: Most monetary columns use bare `numeric` (safe in PostgreSQL but inconsistent). Some have `numeric(12,2)`.
- **Concurrency**: No row-level locking on stock deduction — race conditions possible with multiple cashiers.
- **Audit logging**: Already exists but incomplete coverage.
- **Realtime**: Not configured on any tables.

---

### Phase 1: Concurrency-Safe Stock & Atomic Sale Function (CRITICAL)
Create a `complete_sale` database function that:
- Accepts sale data, items, and payments as parameters
- Uses `SELECT ... FOR UPDATE` to lock stock rows
- Validates sufficient stock before deducting
- Inserts sale, sale_items, payments, and stock_movements atomically
- Returns the created sale ID or raises an error
- Eliminates the current multi-step client-side insert pattern

This alone fixes: race conditions, partial sale corruption, and stock going negative.

### Phase 2: Multi-Tenant Isolation
Add `business_id` to: `categories`, `customers`, `products`, `sales`, `stock_movements`, `cashier_shifts`, `returns`, `payments`, `sale_items`, `credit_transactions`, `installment_plans`, `reorder_rules`, `branch_inventory`

Update RLS policies to enforce `business_id` filtering via a helper function.

### Phase 3: SQL-Level Analytics Functions
Create database functions for:
- `get_dashboard_stats(branch_id, date_range)` — revenue, profit, sale count
- `get_top_products(branch_id, limit, date_range)` — aggregated from sale_items
- `get_low_stock_alerts(branch_id)` — products below threshold

### Phase 4: Realtime & Money Precision
- Enable realtime on `sales`, `stock_movements`, `current_stock`
- Standardize all monetary columns to `numeric(12,2)`
- Add realtime subscriptions in frontend for live stock/sales updates

---

**Approach**: I'll implement Phase 1 first (most critical for data integrity), then Phase 2 (tenant isolation). Each phase is a separate migration + code update.

Shall I proceed?
