-- Support up to 5 images per product
-- product_images stores storage paths (e.g. products/{id}/img_0.webp)

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  path text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Migrate existing image_path to product_images
INSERT INTO product_images (product_id, path, sort_order)
SELECT id, image_path, 0
FROM products
WHERE image_path IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = products.id);
