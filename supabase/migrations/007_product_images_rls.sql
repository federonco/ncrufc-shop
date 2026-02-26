-- Allow anonymous (shop) clients to read product_images.
-- Admin uses service_role and bypasses RLS; shop uses anon and needs this policy.

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_product_images" ON product_images;
CREATE POLICY "anon_select_product_images"
  ON product_images
  FOR SELECT
  TO anon
  USING (true);
