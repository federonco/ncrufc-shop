export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM, optional
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

    const sb = supabaseServer();

    let query = sb
      .from("orders")
      .select("id, reference, customer_name, customer_email, total, status, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (month) {
      const start = `${month}-01T00:00:00Z`;
      const [y, m] = month.split("-").map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      const end = `${ny}-${String(nm).padStart(2, "0")}-01T00:00:00Z`;
      query = query.gte("created_at", start).lt("created_at", end);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length === 0) {
      return NextResponse.json({ orders: [], itemsByOrder: {} });
    }

    const { data: items, error: itemsErr } = await sb
      .from("order_items")
      .select("order_id, variant_id, name, size, qty, unit_price, line_total")
      .in("order_id", orderIds);

    if (itemsErr) throw itemsErr;

    const itemsByOrder: Record<string, typeof items> = {};
    for (const it of items ?? []) {
      const oid = it.order_id;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push(it);
    }

    return NextResponse.json({ orders: orders ?? [], itemsByOrder });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
