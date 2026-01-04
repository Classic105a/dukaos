-- Fix remaining RLS policies for branches and printer_configurations

-- 1. Fix branches table - require authentication for viewing
DROP POLICY IF EXISTS "Users can view basic branch info" ON public.branches;

CREATE POLICY "Authenticated users can view branches"
ON public.branches
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Fix printer_configurations - require authentication
DROP POLICY IF EXISTS "Authenticated users can view printer configurations" ON public.printer_configurations;

CREATE POLICY "Authenticated users can view printer configurations"
ON public.printer_configurations
FOR SELECT
USING (auth.uid() IS NOT NULL);