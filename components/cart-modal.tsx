"use client";

import React, { useMemo, useState } from "react";
import { useCart } from "@/hooks/use-cart";

/**
 * Assumptions about your hook (adjust names if yours differ):
 * useCart() returns:
 *  - items: Array<{ variant_id, product_id, sku, name, size?, unit_price, qty }>
 *  - isOpen: boolean
 *  - close(): void
 *  - clear(): void
 *  - remove(variant_id: string): void
 *  - setQty(variant_id: string, qty: number): void
 */

type CartLine = {
  variant_id: string;
  product_id: string;
  sku: string;
  name: string;
  size?: string | null;
  unit_price: number; // GST included
  qty: number;
};

export default function CartModal() {
  const cart = useCart() as any;

  const isOpen: boolean = cart.isOpen ?? false;
  const close: () => void = cart.close ?? cart.closeCart ?? (() => {});
  const clearCart: () => void = cart.clear ?? (() => {});
  const removeItem: (variantId: string) => void = cart.remove ?? cart.removeItem ?? (() => {});
  const setQty: (variantId: string, qty: number) => void =
    cart.setQty ?? cart.updateQty ?? cart.setQuantity ?? (() => {});

  const cartItems: CartLine[] = (cart.items ?? cart.cartItems ?? []) as CartLine[];

  // ====== Checkout form state (Paso 2.1) ======
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + it.unit_price * it.qty, 0);
  }, [cartItems]);

  // AU GST included -> GST portion = total/11
  const gst = useMemo(() => subtotal / 11, [subtotal]);

  async function placeOrder() {
    setError(null);

    if (cartItems.length === 0) return setError("Your trolley is empty.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email.");

    setIsPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim() || null,
          notes: notes.trim() || null,
          items: cartItems.map((it) => ({
            product_id: it.product_id,
            variant_id: it.variant_id,
            sku: it.sku,
            name: it.name,
            size: it.size ?? null,
            unit_price: it.unit_price,
            qty: it.qty,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Order failed");

      setSuccessRef(data.reference ?? "NC-XXXX");
      clearCart();
    } catch (e: any) {
      setError(e?.message ?? "Order failed");
    } finally {
      setIsPlacing(false);
    }
  }

  function dec(it: CartLine) {
    const next = Math.max(1, (it.qty ?? 1) - 1);
    setQty(it.variant_id, next);
  }
  function inc(it: CartLine) {
    const next = (it.qty ?? 1) + 1;
    setQty(it.variant_id, next);
  }

  // Reset success when opening again (optional)
  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessRef(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        aria-label="Close trolley"
        onClick={close}
        className="absolute inset-0 bg-black/40"
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="text-lg font-semibold">Trolley</div>
            <div className="text-xs opacity-70">Pickup at the next training session.</div>
          </div>

          <button
            onClick={close}
            className="rounded-xl px-3 py-2 border hover:bg-black/5"
          >
            Close
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cartItems.length === 0 ? (
            <div className="text-sm opacity-70">Your trolley is empty.</div>
          ) : (
            cartItems.map((it) => (
              <div key={it.variant_id} className="border rounded-2xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs opacity-70">
                      SKU: {it.sku}
                      {it.size ? ` • Size: ${it.size}` : ""}
                    </div>
                    <div className="text-sm mt-1">
                      ${it.unit_price.toFixed(2)} <span className="text-xs opacity-60">ea (GST incl.)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(it.variant_id)}
                    className="text-sm px-3 py-1 rounded-xl border hover:bg-black/5"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => dec(it)}
                      className="w-9 h-9 rounded-xl border hover:bg-black/5"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <div className="w-10 text-center font-medium">{it.qty}</div>
                    <button
                      onClick={() => inc(it)}
                      className="w-9 h-9 rounded-xl border hover:bg-black/5"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="font-semibold">
                    ${(it.unit_price * it.qty).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout */}
        <div className="border-t p-4">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="opacity-70">Subtotal (GST incl.)</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">GST (included)</span>
              <span>${gst.toFixed(2)}</span>
            </div>
          </div>

          {/* Success */}
          {successRef ? (
            <div className="mt-4 p-3 rounded-2xl bg-black/5">
              <div className="font-semibold">Order placed ✅</div>
              <div className="text-sm mt-1">
                Reference: <b>{successRef}</b>
              </div>
              <div className="text-sm mt-2">
                See you at the next training session for pickup.
              </div>
              <button
                onClick={close}
                className="mt-3 w-full rounded-xl px-4 py-3 bg-black text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Form */}
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1">
                  <label className="text-sm">Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm">Email *</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="you@email.com"
                    autoComplete="email"
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm">Phone (optional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="04xx xxx xxx"
                    autoComplete="tel"
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="Sizes, comments, etc."
                    rows={3}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}

                <button
                  onClick={placeOrder}
                  disabled={isPlacing || cartItems.length === 0}
                  className="w-full rounded-xl px-4 py-3 bg-black text-white disabled:opacity-50"
                >
                  {isPlacing ? "Placing order..." : "Place order"}
                </button>

                <button
                  onClick={clearCart}
                  disabled={cartItems.length === 0 || isPlacing}
                  className="w-full rounded-xl px-4 py-3 border disabled:opacity-50"
                >
                  Clear trolley
                </button>

                <div className="text-xs opacity-70 text-center">
                  Pickup at the next training session.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}