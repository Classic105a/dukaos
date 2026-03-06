
-- Fix 1: Audit logs INSERT - restrict to own user_id only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can only insert their own audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Fix 2: Storage policies - restrict to managers and above
DROP POLICY IF EXISTS "Managers can upload branch logos" ON storage.objects;
DROP POLICY IF EXISTS "Managers can update branch logos" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete branch logos" ON storage.objects;

CREATE POLICY "Managers can upload branch logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'branch-logos'
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Managers can update branch logos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'branch-logos'
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Managers can delete branch logos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'branch-logos'
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);
