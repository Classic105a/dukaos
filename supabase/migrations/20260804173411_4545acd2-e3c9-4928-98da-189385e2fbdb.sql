-- 1) Prevent self-granted elevated roles in business_users
DROP POLICY IF EXISTS "Users can only add themselves without owner" ON public.business_users;
CREATE POLICY "Users can only add themselves as pending staff"
ON public.business_users
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (is_owner = false OR is_owner IS NULL)
  AND (role IS NULL OR role IN ('staff', 'cashier', 'attendant'))
  AND (status IS NULL OR status = 'pending')
);

-- 2) Scope dr-backups reads to the owning business (path prefix = business_id)
DROP POLICY IF EXISTS "Owners and admins read dr-backups" ON storage.objects;
CREATE POLICY "Business owners and admins read own dr-backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dr-backups'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.has_business_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['owner','admin']
      )
);