-- Add installment payment plans table
CREATE TABLE public.installment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL,
  installments_count INTEGER NOT NULL DEFAULT 3,
  installment_amount NUMERIC NOT NULL,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'overdue')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for installment_plans
CREATE POLICY "Authenticated users can view installment plans"
ON public.installment_plans
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage installment plans"
ON public.installment_plans
FOR ALL
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Staff can create installment plans"
ON public.installment_plans
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Add installment_id to credit_transactions
ALTER TABLE public.credit_transactions 
ADD COLUMN IF NOT EXISTS installment_plan_id UUID REFERENCES public.installment_plans(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_installment_plans_updated_at
BEFORE UPDATE ON public.installment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();