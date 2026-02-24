"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCart } from "@/hooks/use-cart";

type Product = {
  id: string;
  category: string | null;
  subcategory: string | null;
  name: string;
  description: string | null;
  sort_order: number | null;
  active: boolean;
};

type Variant = {
  id: string;
  product_id: string;
  sku: string; // kept for backend/cart reference, not shown
  size: string | null;
  price: number; // GST included
  active: boolean;
};

type ProductWithVariants = Product & { variants: Variant[] };

function money(n: number) {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}
function safeLabel(v?: string | null, fallback = "Other") {
  const s = (v ?? "").trim();
  return s.length ? s : fallback;
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "N";
  const b = parts[1]?.[0] ?? "C";
  return (a + b).toUpperCase();
}
function sizeLabel(s?: string | null) {
  const t = (s ?? "").trim();
  return t.length ? t : "One size";
}

export default function ShopPage() {
  // Cart (Zustand)
  const isOpen = useCart((s) => s.isOpen);
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const closeCart = useCart((s) => s.close);
  const addToCart = useCart((s) => s.add);
  const removeItem = useCart((s) => s.remove);
  const setQty = useCart((s) => s.setQty);
  const clear = useCart((s) => s.clear);

  // Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // UI
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const accentBtn = "bg-orange-500 hover:bg-orange-600";

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const pRes = await supabase
        .from("products")
        .select("id,category,subcategory,name,description,sort_order,active")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (pRes.error) {
        if (mounted) {
          setError(pRes.error.message);
          setLoading(false);
        }
        return;
      }

      const vRes = await supabase
        .from("product_variants")
        .select("id,product_id,sku,size,price,active")
        .eq("active", true)
        .order("product_id", { ascending: true })
        .order("size", { ascending: true });

      if (vRes.error) {
        if (mounted) {
          setError(vRes.error.message);
          setLoading(false);
        }
        return;
      }

      const prodRows = (pRes.data ?? []) as Product[];
      const varRows = (vRes.data ?? []) as Variant[];

      const byProductId = new Map<string, Variant[]>();
      for (const v of varRows) {
        const arr = byProductId.get(v.product_id) ?? [];
        arr.push(v);
        byProductId.set(v.product_id, arr);
      }

      const joined: ProductWithVariants[] = prodRows
        .map((p) => ({ ...p, variants: byProductId.get(p.id) ?? [] }))
        .filter((p) => p.variants.length > 0);

      // default selected variant per product (first one)
      const defaults: Record<string, string> = {};
      for (const p of joined) {
        defaults[p.id] = p.variants[0]?.id ?? "";
      }

      if (mounted) {
        setProducts(joined);
        setSelectedVariant(defaults);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const CATEGORY_ORDER = [
  "Training Tops",
  "Senior Polos",
  "Juniors Playing Shorts",
  "Senior Playing Shorts",
  "Ladies Shorts",
  "Socks and Hats",
  "Junior Playing Jerseys",
  "Senior Playing Jerseys",
  "Rain Jackets",
  "Hoodies",
  "Long Subs Jacket",
];

const CATEGORY_INDEX = new Map(
  CATEGORY_ORDER.map((c, i) => [c, i])
);

const categories = useMemo(() => {
  const existing = new Set(products.map((p) => safeLabel(p.category)));

  const ordered = CATEGORY_ORDER.filter((c) => existing.has(c));

  return ["All", ...ordered];
}, [products]);

  const filteredProducts = useMemo(() => {
  const sorted = [...products].sort((a, b) => {
    const aCat = safeLabel(a.category);
    const bCat = safeLabel(b.category);

    const aIndex = CATEGORY_INDEX.get(aCat) ?? 999;
    const bIndex = CATEGORY_INDEX.get(bCat) ?? 999;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    // Dentro de la misma categoría respeta sort_order
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  if (activeCategory === "All") {
    return sorted;
  }

  return sorted.filter(
    (p) => safeLabel(p.category) === activeCategory
  );
}, [products, activeCategory]);

  const cartCount = useMemo(() => items.reduce((acc, it) => acc + (it.qty || 0), 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.unit_price * it.qty, 0),
    [items]
  );
  const gst = useMemo(() => subtotal * (1 / 11), [subtotal]);
  const total = subtotal;

  function toggleExpand(productId: string) {
    setExpanded((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  function handleAdd(product: ProductWithVariants) {
    const variantId = selectedVariant[product.id];
    const v = product.variants.find((x) => x.id === variantId) ?? product.variants[0];
    if (!v) return;

    addToCart({
      variant_id: v.id,
      product_id: product.id,
      sku: v.sku,
      name: product.name,
      size: v.size,
      unit_price: v.price,
      qty: 1,
    });

    const key = `${product.id}:${v.id}`;
    setAddedKey(key);
    window.setTimeout(() => setAddedKey(null), 700);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center justify-between py-4">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-wide text-gray-500">
                NORTH COAST JUNIOR RUFC
              </div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">
                Order Online
              </h1>
              <div className="mt-0.5 text-sm text-gray-600">
                Tap a product → choose size → add
              </div>
            </div>

            <button
              onClick={openCart}
              className={[
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold text-white shadow-sm transition active:translate-y-px",
                accentBtn,
              ].join(" ")}
              aria-label="Open cart"
            >
              <span className="text-base">🛒</span>
              <span className="hidden sm:inline">Cart</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {cartCount}
              </span>
            </button>
          </div>

          {/* Categories */}
          <div className="pb-3">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => {
                const active = c === activeCategory;
                return (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={[
                      "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition",
                      active
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-4 w-2/3 rounded bg-gray-100" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                </div>
                <div className="mt-5 h-3 w-full rounded bg-gray-100" />
                <div className="mt-2 h-3 w-5/6 rounded bg-gray-100" />
                <div className="mt-6 h-10 w-full rounded-2xl bg-gray-100" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
            <div className="font-bold">Error loading products</div>
            <div className="mt-1 text-sm">{error}</div>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-gray-700 shadow-sm">
            No products in this category.
          </div>
        )}

        {/* ✅ 1 tarjeta por renglón */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="space-y-4">
            {filteredProducts.map((p) => {
              const isExpanded = !!expanded[p.id];
              const vId = selectedVariant[p.id] || p.variants[0]?.id;
              const chosen = p.variants.find((v) => v.id === vId) ?? p.variants[0];
              const fromPrice = Math.min(...p.variants.map((v) => v.price));
              const key = chosen ? `${p.id}:${chosen.id}` : null;
              const justAdded = key ? addedKey === key : false;

              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gray-900 text-sm font-extrabold text-white">
                        {initials(p.name)}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-500">
                          {safeLabel(p.category)}
                          {p.subcategory ? ` • ${safeLabel(p.subcategory, "")}` : ""}
                        </div>
                        <h3 className="mt-0.5 text-lg font-black tracking-tight text-gray-900">
                          {p.name}
                        </h3>
                      </div>
                    </div>

                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700">
                      {money(fromPrice)}+
                    </span>
                  </div>

                  {p.description && (
                    <p className="mt-3 text-sm text-gray-600">{p.description}</p>
                  )}

                  {/* Select size accordion */}
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className={[
                      "mt-4 w-full rounded-2xl border px-4 py-3 text-left text-sm font-extrabold transition",
                      isExpanded
                        ? "border-gray-300 bg-gray-50 text-gray-900"
                        : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        Size:{" "}
                        <span className="font-black">
                          {chosen ? sizeLabel(chosen.size) : "Select"}
                        </span>
                      </span>
                      <span className="text-gray-500">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Prices include GST
                    </div>
                  </button>

                  {/* ✅ despliegue SOLO opciones de talles + botón fijo */}
                  {isExpanded && (
                    <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-4">
                      {/* Size options (chips) */}
                      <div className="flex flex-wrap gap-2">
                        {p.variants.map((v) => {
                          const active = (selectedVariant[p.id] || p.variants[0]?.id) === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() =>
                                setSelectedVariant((prev) => ({ ...prev, [p.id]: v.id }))
                              }
                              className={[
                                "rounded-full px-3 py-2 text-sm font-extrabold transition border",
                                active
                                  ? "bg-gray-900 text-white border-gray-900"
                                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              {sizeLabel(v.size)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Fixed add row */}
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="text-sm">
                          <div className="text-gray-500 text-xs font-bold">Price</div>
                          <div className="text-gray-900 font-black">
                            {chosen ? money(chosen.price) : money(fromPrice)}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAdd(p)}
                          className={[
                            "rounded-full px-5 py-3 text-sm font-extrabold text-white transition active:translate-y-px",
                            justAdded ? "bg-emerald-600" : accentBtn,
                          ].join(" ")}
                        >
                          {justAdded ? "Added ✓" : "+ Add"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating cart pill */}
      <button
        onClick={openCart}
        className={[
          "fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-extrabold text-white shadow-lg transition active:translate-y-px",
          accentBtn,
        ].join(" ")}
        aria-label="Open cart (floating)"
      >
        🛒 <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{cartCount}</span>
      </button>

      {/* CART: Mobile bottom sheet + Desktop right drawer */}
      <div className={["fixed inset-0 z-50", isOpen ? "" : "pointer-events-none"].join(" ")}>
        <div
          onClick={closeCart}
          className={[
            "absolute inset-0 bg-black/40 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        {/* Mobile bottom sheet */}
        <div
          className={[
            "absolute bottom-0 left-0 right-0 max-h-[82vh] rounded-t-3xl bg-white shadow-2xl transition-transform sm:hidden",
            isOpen ? "translate-y-0" : "translate-y-full",
          ].join(" ")}
        >
          <CartContent
            items={items}
            cartCount={cartCount}
            subtotal={subtotal}
            gst={gst}
            total={total}
            accentBtn={accentBtn}
            onClose={closeCart}
            onClear={clear}
            onRemove={removeItem}
            onSetQty={setQty}
          />
        </div>

        {/* Desktop drawer */}
        <div
          className={[
            "absolute right-0 top-0 hidden h-full w-[420px] max-w-[92vw] bg-white shadow-2xl transition-transform sm:block",
            isOpen ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <CartContent
            items={items}
            cartCount={cartCount}
            subtotal={subtotal}
            gst={gst}
            total={total}
            accentBtn={accentBtn}
            onClose={closeCart}
            onClear={clear}
            onRemove={removeItem}
            onSetQty={setQty}
          />
        </div>
      </div>
    </div>
  );
}

function CartContent(props: {
  items: Array<{
    variant_id: string;
    sku: string;
    name: string;
    size?: string | null;
    unit_price: number;
    qty: number;
  }>;
  cartCount: number;
  subtotal: number;
  gst: number;
  total: number;
  accentBtn: string;
  onClose: () => void;
  onClear: () => void;
  onRemove: (variant_id: string) => void;
  onSetQty: (variant_id: string, qty: number) => void;
}) {
  const { items, cartCount, subtotal, gst, total, accentBtn, onClose, onClear, onRemove, onSetQty } =
    props;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-gray-500">Your cart</div>
            <div className="text-lg font-black text-gray-900">{cartCount} item(s)</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-bold hover:bg-gray-50 transition"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-gray-900 px-3 py-1.5 text-sm font-bold text-white hover:opacity-90 transition"
            >
              Close ✕
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-gray-700">
            Empty cart. Add items from the shop.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.variant_id} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-gray-900">{it.name}</div>
                    <div className="truncate text-xs text-gray-500">
                      {it.size ?? "One size"}
                    </div>
                  </div>

                  <button
                    onClick={() => onRemove(it.variant_id)}
                    className="text-sm font-black text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">{money(it.unit_price)} each</div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSetQty(it.variant_id, it.qty - 1)}
                      className="h-9 w-9 rounded-full border border-gray-200 text-lg hover:bg-gray-50 active:translate-y-px transition"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <div className="min-w-8 text-center text-sm font-black">{it.qty}</div>
                    <button
                      onClick={() => onSetQty(it.variant_id, it.qty + 1)}
                      className="h-9 w-9 rounded-full border border-gray-200 text-lg hover:bg-gray-50 active:translate-y-px transition"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-sm font-black text-gray-900">
                    {money(it.unit_price * it.qty)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-4 py-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal (GST incl.)</span>
            <span className="font-black">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">GST (indicative)</span>
            <span className="text-gray-800">{money(gst)}</span>
          </div>
          <div className="flex justify-between text-base">
            <span className="font-black">Total</span>
            <span className="font-black">{money(total)}</span>
          </div>
        </div>

        <button
          disabled={items.length === 0}
          className={[
            "mt-3 w-full rounded-2xl px-4 py-3 font-black text-white transition active:translate-y-px",
            items.length === 0 ? "bg-gray-300 cursor-not-allowed" : accentBtn,
          ].join(" ")}
          onClick={() => alert("Next step: create order + send email ✅")}
        >
          Checkout
        </button>

        <div className="mt-2 text-xs text-gray-500">
          Prices include GST. Final amounts are calculated on order creation.
        </div>
      </div>
    </div>
  );
}