
-- 1. BUSINESSES table (multi-business support, fully separate from branches)
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'retail',
  logo_url text,
  currency text DEFAULT 'KES',
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Business-user membership
CREATE TABLE public.business_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'staff',
  is_owner boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, user_id)
);
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- Link branches to businesses
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

-- 2. SUPPLIERS / PARTIES table
CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  party_type text NOT NULL DEFAULT 'supplier', -- supplier, dealer, wholesaler, retailer, bank
  phone text,
  email text,
  address text,
  opening_balance numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  pricing_tier text DEFAULT 'standard', -- standard, wholesale, dealer
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

-- 3. PAYABLE TRANSACTIONS (Your Balance - money owed to suppliers)
CREATE TABLE public.payable_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL, -- PURCHASE, PAYMENT, ADJUSTMENT, OPENING_BALANCE
  amount numeric NOT NULL,
  running_balance numeric NOT NULL DEFAULT 0,
  payment_method text, -- cash, mpesa, bank_transfer, cheque
  reference text,
  notes text,
  processed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payable_transactions ENABLE ROW LEVEL SECURITY;

-- 4. CUSTOM PERMISSIONS (granular toggle-based per user)
CREATE TABLE public.custom_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Sales toggles
  can_apply_discounts boolean DEFAULT false,
  can_void_cart_items boolean DEFAULT false,
  can_edit_past_sales boolean DEFAULT false,
  can_change_prices boolean DEFAULT false,
  -- Inventory toggles
  can_view_purchase_prices boolean DEFAULT false,
  can_edit_stock_levels boolean DEFAULT false,
  can_perform_transfers boolean DEFAULT false,
  can_see_stock_value boolean DEFAULT false,
  -- Finance toggles
  can_view_net_profit boolean DEFAULT false,
  can_access_wallet boolean DEFAULT false,
  can_approve_withdrawals boolean DEFAULT false,
  can_see_payables boolean DEFAULT false,
  -- System toggles
  can_add_delete_staff boolean DEFAULT false,
  can_change_settings boolean DEFAULT false,
  can_export_data boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, business_id)
);
ALTER TABLE public.custom_permissions ENABLE ROW LEVEL SECURITY;

-- 5. LEGAL CASES (SCC tracker)
CREATE TABLE public.legal_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
  case_number text,
  court_name text DEFAULT 'Small Claims Court',
  amount_claimed numeric NOT NULL DEFAULT 0,
  filing_date date,
  next_hearing_date date,
  status text DEFAULT 'filed', -- filed, hearing_scheduled, judgement, settled, closed
  outcome text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Businesses: members can view, owners can manage
CREATE POLICY "Members can view their businesses" ON public.businesses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_users WHERE business_id = businesses.id AND user_id = auth.uid())
  );
CREATE POLICY "Owners can manage businesses" ON public.businesses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.business_users WHERE business_id = businesses.id AND user_id = auth.uid() AND is_owner = true)
  );
CREATE POLICY "Authenticated can create businesses" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Business users
CREATE POLICY "Members can view business users" ON public.business_users
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id = business_users.business_id AND bu.user_id = auth.uid() AND bu.is_owner = true)
  );
CREATE POLICY "Owners can manage business users" ON public.business_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id = business_users.business_id AND bu.user_id = auth.uid() AND bu.is_owner = true)
  );
CREATE POLICY "Users can insert themselves" ON public.business_users
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Parties
CREATE POLICY "Auth users can view parties" ON public.parties
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage parties" ON public.parties
  FOR ALL USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );

-- Payable transactions
CREATE POLICY "Auth users can view payables" ON public.payable_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage payables" ON public.payable_transactions
  FOR ALL USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );
CREATE POLICY "Staff can create payables" ON public.payable_transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND processed_by = auth.uid());

-- Custom permissions
CREATE POLICY "Users can view own permissions" ON public.custom_permissions
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage permissions" ON public.custom_permissions
  FOR ALL USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Legal cases
CREATE POLICY "Auth users can view legal cases" ON public.legal_cases
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage legal cases" ON public.legal_cases
  FOR ALL USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );

-- Updated at triggers
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_custom_permissions_updated_at BEFORE UPDATE ON public.custom_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_legal_cases_updated_at BEFORE UPDATE ON public.legal_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
