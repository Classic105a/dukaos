-- Create returns table for tracking product returns
CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_sale_id UUID REFERENCES public.sales(id),
  branch_id UUID REFERENCES public.branches(id),
  processed_by UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view returns" ON public.returns FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create returns" ON public.returns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();