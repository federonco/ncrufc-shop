export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendOrderEmail } from "@/lib/email";

type CartItem = {
  product_id: string;
  variant_id: string;
  sku: string;
  name: string;
  size?: string | null;
  unit_price: number;
  qty: number;
};

function makeReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `NC-${s}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customer_name, customer_email, customer_phone, notes, items } = body as {
      customer_name: string;
      customer_email: string;
      customer_phone?: string | null;
      notes?: string | null;
      items: CartItem[];
    };

    if (!customer_name || !customer_email || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const subtotal = items.reduce((acc, it) => acc + it.unit_price * it.qty, 0);
    const gst = subtotal / 11;
    const total = subtotal;

    const sb = supabaseServer();

    // unique-ish reference
    let reference = makeReference();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await sb.from("orders").select("id").eq("reference", reference).maybeSingle();
      if (!existing) break;
      reference = makeReference();
    }

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        reference,
        customer_name,
        customer_email,
        customer_phone: customer_phone ?? null,
        notes: notes ?? null,
        subtotal,
        gst,
        total,
        status: "submitted",
      })
      .select("id, reference, total, created_at")
      .single();

    if (orderErr) throw orderErr;

    const orderItems = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      variant_id: it.variant_id,
      sku: it.sku,
      name: it.name,
      size: it.size ?? null,
      unit_price: it.unit_price,
      qty: it.qty,
      line_total: it.unit_price * it.qty,
    }));

    const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;

    // email (simple)
    await sendOrderEmail({
      subject: `New Order ${order.reference}`,
      html: `
        <h2>New Order ${order.reference}</h2>
        <p><b>Name:</b> ${customer_name}</p>
        <p><b>Email:</b> ${customer_email}</p>
        <p><b>Phone:</b> ${customer_phone ?? ""}</p>
        <p><b>Notes:</b> ${notes ?? ""}</p>
        <hr/>
        <ul>
          ${items
            .map((it) => `<li>${it.qty} x ${it.name}${it.size ? ` (${it.size})` : ""} — $${(it.unit_price * it.qty).toFixed(2)}</li>`)
            .join("")}
        </ul>
        <p><b>Total (GST incl.):</b> $${total.toFixed(2)}</p>
        <p>Pickup at the next training session.</p>
      `,
    });

    return NextResponse.json({ ok: true, reference: order.reference });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}