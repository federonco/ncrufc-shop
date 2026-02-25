export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendOrderEmail } from "@/lib/email";

// Canonical payload contract
type CheckoutPayload = {
  customer: { name: string; email: string; phone?: string | null };
  notes?: string | null;
  items: Array<{ variant_id: string; qty: number; product_name?: string; size?: string | null }>;
};

type ResolvedItem = {
  variant_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  size: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Checkout API ready. POST with customer + items.",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;

    // Validate shape
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { customer, notes, items } = body as CheckoutPayload;

    if (!customer || typeof customer !== "object") {
      return NextResponse.json({ error: "Missing or invalid customer object" }, { status: 400 });
    }

    const customer_name = (customer.name ?? "").toString().trim();
    const customer_email = (customer.email ?? "").toString().trim();
    const customer_phone = customer.phone != null ? String(customer.phone).trim() || null : null;

    if (!customer_name) {
      return NextResponse.json({ error: "customer.name is required" }, { status: 400 });
    }
    if (!customer_email) {
      return NextResponse.json({ error: "customer.email is required" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
    }

    const sb = supabaseServer();

    // Resolve each variant from DB (do NOT trust client prices)
    const resolved: ResolvedItem[] = [];
    for (const it of items) {
      const variant_id = (it.variant_id ?? "").toString().trim();
      const qty = Math.max(1, Math.min(99, Math.floor(Number(it.qty) || 1)));

      if (!variant_id) continue;

      const { data: variant, error: varErr } = await sb
        .from("product_variants")
        .select("id, product_id, sku, size, price")
        .eq("id", variant_id)
        .maybeSingle();

      if (varErr) throw varErr;
      if (!variant) {
        return NextResponse.json(
          { error: `Variant not found: ${variant_id}` },
          { status: 400 }
        );
      }

      const { data: product } = await sb
        .from("products")
        .select("name")
        .eq("id", variant.product_id)
        .maybeSingle();

      const product_name = (product?.name ?? it.product_name ?? "Unknown").toString();
      const unit_price = Number(variant.price);
      if (!Number.isFinite(unit_price) || unit_price < 0) {
        return NextResponse.json(
          { error: `Invalid price for variant ${variant_id}` },
          { status: 400 }
        );
      }

      resolved.push({
        variant_id: variant.id,
        product_id: variant.product_id,
        product_name,
        sku: variant.sku ?? "",
        size: variant.size ?? null,
        unit_price,
        qty,
        line_total: unit_price * qty,
      });
    }

    if (resolved.length === 0) {
      return NextResponse.json({ error: "No valid items to order" }, { status: 400 });
    }

    const subtotal = resolved.reduce((acc, it) => acc + it.line_total, 0);
    const gst = subtotal / 11;
    const total = subtotal;

    // Unique reference (NCR-XXXXXX). Omit if your DB has DEFAULT sequence.
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let reference = "NCR-";
    for (let i = 0; i < 6; i++) reference += chars[Math.floor(Math.random() * chars.length)];

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        reference,
        customer_name,
        customer_email,
        customer_phone,
        notes: notes != null ? String(notes).trim() || null : null,
        subtotal,
        gst,
        total,
        status: "submitted",
      })
      .select("id, reference, total, created_at")
      .single();

    if (orderErr) {
      console.error("Order insert error:", orderErr);
      return NextResponse.json(
        { error: orderErr.message ?? "Failed to create order" },
        { status: 500 }
      );
    }

    const orderItems = resolved.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      variant_id: it.variant_id,
      sku: it.sku,
      name: it.product_name,
      size: it.size,
      unit_price: it.unit_price,
      qty: it.qty,
      line_total: it.line_total,
    }));

    const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
    if (itemsErr) {
      console.error("Order items insert error:", itemsErr);
      return NextResponse.json(
        { error: itemsErr.message ?? "Failed to create order items" },
        { status: 500 }
      );
    }

    // Email – optional; must not block checkout
    try {
      await sendOrderEmail({
        subject: `New Order ${order.reference ?? order.id}`,
        html: `
          <h2>New Order ${order.reference ?? order.id}</h2>
          <p><b>Name:</b> ${customer_name}</p>
          <p><b>Email:</b> ${customer_email}</p>
          <p><b>Phone:</b> ${customer_phone ?? ""}</p>
          <p><b>Notes:</b> ${notes ?? ""}</p>
          <hr/>
          <ul>
            ${resolved
              .map(
                (it) =>
                  `<li>${it.qty} x ${it.product_name}${it.size ? ` (${it.size})` : ""} — $${it.line_total.toFixed(2)}</li>`
              )
              .join("")}
          </ul>
          <p><b>Total (GST incl.):</b> $${total.toFixed(2)}</p>
          <p>Pickup at the next training session, paying on card only.</p>
        `,
      });
    } catch (emailErr) {
      console.warn("Email send failed (checkout succeeded):", emailErr);
      // Do not fail checkout
    }

    return NextResponse.json({
      ok: true,
      reference: order.reference ?? `NCR-${String(order.id).slice(-6)}`,
      order_id: order.id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("Checkout error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
