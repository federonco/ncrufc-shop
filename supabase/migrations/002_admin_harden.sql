-- =============================================================================
-- NCRUFC SHOP – Admin schema hardening (production-grade)
-- Run in Supabase SQL Editor
-- =============================================================================

-- 1) Stock column: safe defaults, NOT NULL, non-negative
-- -----------------------------------------------------------------------------
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;

UPDATE product_variants SET stock = COALESCE(stock, 0) WHERE stock IS NULL;

ALTER TABLE product_variants
  ALTER COLUMN stock SET DEFAULT 0,
  ALTER COLUMN stock SET NOT NULL;

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_stock_non_negative;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_stock_non_negative CHECK (stock >= 0);


-- 2) paid_at in orders (timestamptz)
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;


-- 3) pay_order RPC (idempotent, secure)
--    Updates paid_at only (status column may not exist)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE orders
  SET paid_at = COALESCE(paid_at, now())
  WHERE id = p_order_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  RETURN json_build_object('ok', true, 'order_id', p_order_id);
END;
$$;


-- 4) Permissions for authenticated role
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.pay_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order(uuid) TO service_role;
