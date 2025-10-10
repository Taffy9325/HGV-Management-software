-- Supabase Storage Setup
-- Run this separately in Supabase Dashboard after running the main schema

-- Create storage bucket for inspection documents (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
SELECT 'inspections', 'inspections', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'inspections');

-- Create storage bucket for vehicle documents (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
SELECT 'vehicle-documents', 'vehicle-documents', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vehicle-documents');

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload inspection files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own inspection files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own inspection files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own inspection files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update vehicle documents" ON storage.objects;

-- Storage policies for inspection documents
CREATE POLICY "Users can upload inspection files" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own inspection files" ON storage.objects FOR SELECT USING (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own inspection files" ON storage.objects FOR DELETE USING (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own inspection files" ON storage.objects FOR UPDATE USING (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for vehicle documents
CREATE POLICY "Users can upload vehicle documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'vehicle-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view vehicle documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'vehicle-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete vehicle documents" ON storage.objects FOR DELETE USING (
  bucket_id = 'vehicle-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update vehicle documents" ON storage.objects FOR UPDATE USING (
  bucket_id = 'vehicle-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
