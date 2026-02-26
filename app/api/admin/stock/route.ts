export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lowOnly = searchParams.get("low") !== "false"; // default: filter stock < 5

    const sb = supabaseServer();

    const { data: variants, error } = await sb
      .from("product_variants")
      .select(`
        id,
        product_id,
        sku,
        size,
        price,
        stock,
        active,
        products (
          id,
          name,
          category,
          subcategory,
          sort_order,
          image_path,
          image_alt
        )
      `);

    if (error) throw error;

    type Row = {
      id: string;
      product_id: string;
      sku: string;
      size: string | null;
      price: number;
      stock: number | null;
      active: boolean;
      products: { id: string; name: string; category: string | null; subcategory: string | null; sort_order: number | null; image_path: string | null; image_alt: string | null } | null;
    };

    let rows = (variants ?? []) as unknown as Row[];
    if (lowOnly) {
      rows = rows.filter((r) => (r.stock ?? 0) < 5);
    }

    // Group by category → product → variants
    type Grouped = {
      category: string;
      products: {
        id: string;
        name: string;
        subcategory: string | null;
        image_path: string | null;
        image_alt: string | null;
        images?: string[];
        variants: { id: string; sku: string; size: string | null; price: number; stock: number }[];
      }[];
    };
    const byCategory = new Map<string, Grouped["products"]>();

    for (const r of rows) {
      const cat = (r.products?.category ?? "").trim() || "Uncategorized";
      const prod = r.products;
      if (!prod) continue;

      let prods = byCategory.get(cat);
      if (!prods) {
        prods = [];
        byCategory.set(cat, prods);
      }

      let prodEntry = prods.find((p) => p.id === prod.id);
      if (!prodEntry) {
        prodEntry = {
          id: prod.id,
          name: prod.name ?? "Unknown",
          subcategory: prod.subcategory ?? null,
          image_path: prod.image_path ?? null,
          image_alt: prod.image_alt ?? null,
          variants: [],
        };
        prods.push(prodEntry);
      }

      prodEntry.variants.push({
        id: r.id,
        sku: r.sku ?? "",
        size: r.size ?? null,
        price: Number(r.price) || 0,
        stock: Number(r.stock) ?? 0,
      });
    }

    const productIds = [...new Set(Array.from(byCategory.values()).flatMap((prods) => prods.map((p) => p.id)))];
    const { data: imagesRows } = await sb
      .from("product_images")
      .select("product_id, path, sort_order")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true });

    const imagesByProduct = new Map<string, string[]>();
    for (const img of imagesRows ?? []) {
      const arr = imagesByProduct.get(img.product_id) ?? [];
      arr.push(img.path);
      imagesByProduct.set(img.product_id, arr);
    }

    const grouped: Grouped[] = Array.from(byCategory.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, products]) => {
        const sorted = [...products].sort(
          (a, b) => (a.name ?? "").localeCompare(b.name ?? "")
        );
        sorted.forEach((p) => {
          p.variants.sort((a, b) => (a.size ?? "").localeCompare(b.size ?? ""));
          const imgs = imagesByProduct.get(p.id);
          p.image_path = imgs?.[0] ?? p.image_path;
          (p as { images?: string[] }).images = imgs ?? (p.image_path ? [p.image_path] : []);
        });
        return { category, products: sorted };
      });

    return NextResponse.json({ grouped });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
