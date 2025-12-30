-- Create a public storage bucket for branch logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('branch-logos', 'branch-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view branch logos (public bucket)
CREATE POLICY "Branch logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'branch-logos');

-- Allow authenticated managers+ to upload logos
CREATE POLICY "Managers can upload branch logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branch-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated managers+ to update logos
CREATE POLICY "Managers can update branch logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'branch-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated managers+ to delete logos
CREATE POLICY "Managers can delete branch logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'branch-logos' 
  AND auth.role() = 'authenticated'
);