-- Add stock to product_variants (if not exists)
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;

-- Add paid_at to orders for mark_paid
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- RPC: pay_order - marks order as paid
CREATE OR REPLACE FUNCTION pay_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE orders SET paid_at = now() WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  RETURN json_build_object('ok', true, 'order_id', p_order_id);
END;
$$;
