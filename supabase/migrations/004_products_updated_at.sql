-- Add updated_at to products for cache busting (if not exists)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger to auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE PROCEDURE set_products_updated_at();
