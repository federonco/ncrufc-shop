export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { stock?: number; price?: number };

    const updates: { stock?: number; price?: number } = {};
    if (typeof body.stock === "number" && body.stock >= 0) {
      updates.stock = Math.floor(body.stock);
    }
    if (typeof body.price === "number" && body.price >= 0) {
      updates.price = body.price;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Provide stock and/or price" }, { status: 400 });
    }

    const sb = supabaseServer();
    const { data, error } = await sb
      .from("product_variants")
      .update(updates)
      .eq("id", id)
      .select("id, stock, price")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
