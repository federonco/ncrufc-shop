import { supabase } from "@/lib/supabase/client";

export type ShopRow = {
  variant_id: string;
  sku: string;
  size: string | null;
  price: number;

  product_id: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  sort_order: number | null;
};

export async function fetchShopRows(): Promise<ShopRow[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `
      id,
      sku,
      size,
      price,
      product:products (
        id,
        name,
        description,
        category,
        subcategory,
        sort_order,
        active
      )
    `
    )
    .eq("active", true)
    .eq("product.active", true);

  if (error) throw error;

  // Normalizamos a filas planas
  const rows: ShopRow[] = (data ?? []).map((r: any) => ({
    variant_id: r.id,
    sku: r.sku,
    size: r.size ?? null,
    price: Number(r.price),

    product_id: r.product.id,
    name: r.product.name,
    description: r.product.description ?? null,
    category: r.product.category ?? null,
    subcategory: r.product.subcategory ?? null,
    sort_order: r.product.sort_order ?? null,
  }));

  // Orden estable (por sort_order y nombre)
  rows.sort((a, b) => {
    const sa = a.sort_order ?? 999999;
    const sb = b.sort_order ?? 999999;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  return rows;
}