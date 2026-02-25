export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    const sb = supabaseServer();

    let start: string;
    let end: string;
    if (month) {
      start = `${month}-01T00:00:00Z`;
      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? y + 1 : y;
      end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00Z`;
    } else {
      const d = new Date();
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      start = `${y}-${String(m).padStart(2, "0")}-01T00:00:00Z`;
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      end = `${ny}-${String(nm).padStart(2, "0")}-01T00:00:00Z`;
    }

    const { data: orders, error } = await sb
      .from("orders")
      .select("id, total, paid_at, status, created_at")
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) throw error;

    const orderList = orders ?? [];
    const revenue = orderList
      .filter((o) => o.paid_at != null)
      .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const unpaidList = orderList.filter((o) => o.paid_at == null && o.status !== "cancelled");
    const potentialRevenue = unpaidList.reduce(
      (acc, o) => acc + (Number(o.total) || 0),
      0
    );
    const paid = orderList.filter((o) => o.paid_at != null).length;
    const unpaid = unpaidList.length;

    return NextResponse.json({
      month: month ?? new Date().toISOString().slice(0, 7),
      revenue,
      potentialRevenue,
      ordersCount: orderList.length,
      paidCount: paid,
      unpaidCount: unpaid,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
