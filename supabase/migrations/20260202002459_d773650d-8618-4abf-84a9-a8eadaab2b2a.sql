-- =============================================
-- ENTERPRISE POS UPGRADE: Phase 1
-- Customer Credit, Audit Logs, Enhanced Permissions
-- =============================================

-- 1. CUSTOMER CREDIT SYSTEM
-- Add credit fields to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_enabled boolean DEFAULT false;

-- Create credit transactions table (payment history)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('CREDIT_SALE', 'PAYMENT', 'ADJUSTMENT', 'REFUND')),
  amount numeric NOT NULL,
  running_balance numeric NOT NULL,
  payment_method text,
  reference text,
  notes text,
  processed_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_transactions
CREATE POLICY "Authenticated users can view credit transactions"
ON public.credit_transactions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create credit transactions"
ON public.credit_transactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND processed_by = auth.uid());

CREATE POLICY "Managers can manage credit transactions"
ON public.credit_transactions FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 2. AUDIT LOGGING SYSTEM
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  branch_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on audit_logs (read-only for managers, full for owners/admins)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view audit logs"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. CASHIER SHIFTS SYSTEM
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  cashier_id uuid NOT NULL,
  opened_at timestamp with time zone DEFAULT now() NOT NULL,
  closed_at timestamp with time zone,
  opening_float numeric DEFAULT 0 NOT NULL,
  expected_cash numeric,
  actual_cash numeric,
  cash_discrepancy numeric,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  notes text,
  closed_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shifts"
ON public.cashier_shifts FOR SELECT
USING (cashier_id = auth.uid() OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can create their own shifts"
ON public.cashier_shifts FOR INSERT
WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Users can update their own open shifts"
ON public.cashier_shifts FOR UPDATE
USING (cashier_id = auth.uid() AND status = 'open');

CREATE POLICY "Managers can manage all shifts"
ON public.cashier_shifts FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 4. Add shift_id to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.cashier_shifts(id),
ADD COLUMN IF NOT EXISTS cost_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_total numeric DEFAULT 0;

-- 5. MANAGER APPROVAL FOR REFUNDS
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('REFUND', 'VOID', 'DISCOUNT', 'PRICE_OVERRIDE', 'CREDIT_SALE')),
  requested_by uuid NOT NULL,
  approved_by uuid,
  branch_id uuid REFERENCES public.branches(id),
  entity_type text NOT NULL,
  entity_id uuid,
  request_data jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reason text,
  approval_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
ON public.approval_requests FOR SELECT
USING (requested_by = auth.uid() OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can create approval requests"
ON public.approval_requests FOR INSERT
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Managers can update approval requests"
ON public.approval_requests FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 6. Add PIN to profiles for manager override
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS manager_pin text,
ADD COLUMN IF NOT EXISTS pin_hash text;

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_cashier_shifts_updated_at
BEFORE UPDATE ON public.cashier_shifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON public.credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_cashier ON public.cashier_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status ON public.cashier_shifts(status);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON public.sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);