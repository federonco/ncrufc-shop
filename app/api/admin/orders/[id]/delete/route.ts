export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = supabaseServer();

    const { error: itemsError } = await sb
      .from("order_items")
      .delete()
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    const { data, error } = await sb
      .from("orders")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
