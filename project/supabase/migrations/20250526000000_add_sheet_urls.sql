
t
INSERT INTO storage.buckets (id, name)
VALUES 
  ('music-sheets-xml', 'music-sheets-xml'),
  ('music-sheets-midi', 'music-sheets-midi')
ON CONFLICT DO NOTHING;

-- Set up storage policies for the new buckets
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id IN ('music-sheets-xml', 'music-sheets-midi'));

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('music-sheets-xml', 'music-sheets-midi'));
