-- Product images: storage path and alt text
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_alt text;
