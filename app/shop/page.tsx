"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { getProductImageUrl } from "@/lib/product-image";
import { useCart } from "@/hooks/use-cart";

type Product = {
  id: string;
  category: string | null;
  subcategory: string | null;
  name: string;
  description: string | null;
  sort_order: number | null;
  active: boolean;
  image_path: string | null;
  image_alt: string | null;
  images?: string[];
  updated_at?: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  sku: string;
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
function clampQty(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.floor(n)));
}

function ProductImage({
  imagePath,
  imageAlt,
  name,
  updatedAt,
  size = 48,
  variant = "thumb",
  onClick,
}: {
  imagePath: string | null | undefined;
  imageAlt?: string | null;
  name: string;
  updatedAt?: string | null;
  size?: number;
  variant?: "thumb" | "card";
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const version = updatedAt ? new Date(updatedAt).getTime() : undefined;
  const url = imagePath ? getProductImageUrl(imagePath, version) : null;
  const isCard = variant === "card";

  if (!url) {
    if (isCard) {
      return (
        <div className="relative w-full aspect-[4/5] bg-gray-200 rounded-t-xl sm:rounded-t-2xl grid place-items-center">
          <span className="text-2xl font-extrabold text-gray-400">{initials(name)}</span>
        </div>
      );
    }
    return (
      <div
        className="shrink-0 grid place-items-center rounded-2xl bg-gray-900 text-sm font-extrabold text-white"
        style={{ width: size, height: size }}
      >
        {initials(name)}
      </div>
    );
  }

  if (isCard) {
    return (
      <div
        className={[
          "relative w-full aspect-[4/5] overflow-hidden bg-gray-100",
          "rounded-t-xl sm:rounded-t-2xl",
          onClick ? "cursor-pointer hover:opacity-95 transition-opacity" : "",
        ].join(" ")}
        onClick={onClick}
        onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `View ${name} image` : undefined}
      >
        <div
          className={`absolute inset-0 bg-gray-200 transition-opacity duration-300 ${
            loaded ? "opacity-0" : "opacity-100 animate-pulse"
          }`}
          aria-hidden
        />
        <Image
          src={url}
          alt={imageAlt?.trim() || name}
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-2xl bg-gray-100",
        onClick ? "cursor-pointer hover:opacity-90 transition" : "",
      ].join(" ")}
      style={{ width: size, height: size }}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `View ${name} image` : undefined}
    >
      <Image
        src={url}
        alt={imageAlt?.trim() || name}
        width={size}
        height={size}
        className="object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
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
  const clearItems = useCart((s) => s.clearItems);

  // Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // UI
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; alt: string } | null>(null);

  const accentBtn = "bg-orange-500 hover:bg-orange-600";

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.touchAction = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageModal(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Category order (manual)
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
  const CATEGORY_INDEX = useMemo(
    () => new Map(CATEGORY_ORDER.map((c, i) => [c, i])),
    []
  );

  const catRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
      const pRes = await supabase
        .from("products")
        .select("id,category,subcategory,name,description,sort_order,active,image_path,image_alt,updated_at")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (pRes.error) {
        if (mounted) {
          const msg = pRes.error.message;
          const isFetchFailed =
            msg?.includes("Failed to fetch") ||
            msg?.includes("fetch") ||
            msg?.includes("NetworkError");
          setError(
            isFetchFailed
              ? "Could not reach Supabase. Check: (1) NEXT_PUBLIC_SUPABASE_URL is correct (https://xxx.supabase.co, no trailing slash), (2) project is not paused in Supabase dashboard, (3) network/firewall allows supabase.co"
              : msg
          );
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
          const msg = vRes.error.message;
          const isFetchFailed =
            msg?.includes("Failed to fetch") ||
            msg?.includes("fetch") ||
            msg?.includes("NetworkError");
          setError(
            isFetchFailed
              ? "Could not reach Supabase. Check: (1) NEXT_PUBLIC_SUPABASE_URL is correct (https://xxx.supabase.co, no trailing slash), (2) project is not paused in Supabase dashboard, (3) network/firewall allows supabase.co"
              : msg
          );
          setLoading(false);
        }
        return;
      }

      const prodRows = (pRes.data ?? []) as Product[];
      const varRows = (vRes.data ?? []) as Variant[];

      const { data: imagesRows } = await supabase
        .from("product_images")
        .select("product_id, path, sort_order")
        .in("product_id", prodRows.map((p) => p.id))
        .order("sort_order", { ascending: true });

      const imagesByProduct = new Map<string, string[]>();
      for (const img of imagesRows ?? []) {
        const arr = imagesByProduct.get(img.product_id) ?? [];
        arr.push(img.path);
        imagesByProduct.set(img.product_id, arr);
      }

      const byProductId = new Map<string, Variant[]>();
      for (const v of varRows) {
        const arr = byProductId.get(v.product_id) ?? [];
        arr.push(v);
        byProductId.set(v.product_id, arr);
      }

      const joined: ProductWithVariants[] = prodRows
        .map((p) => {
          const imgs = imagesByProduct.get(p.id);
          const imagePath = imgs?.[0] ?? p.image_path;
          return {
            ...p,
            image_path: imagePath,
            images: imgs ?? (p.image_path ? [p.image_path] : []),
            variants: byProductId.get(p.id) ?? [],
          };
        })
        .filter((p) => p.variants.length > 0);

      // defaults
      const defaultsVar: Record<string, string> = {};
      const defaultsQty: Record<string, number> = {};
      for (const p of joined) {
        defaultsVar[p.id] = p.variants[0]?.id ?? "";
        defaultsQty[p.id] = 1;
      }

      if (mounted) {
        setProducts(joined);
        setSelectedVariant(defaultsVar);
        setQtyByProduct(defaultsQty);
        setLoading(false);
      }
      } catch (e) {
        if (mounted) {
          const msg = e instanceof Error ? e.message : String(e);
          const isFetchFailed = msg?.includes("Failed to fetch") || msg?.includes("fetch");
          setError(
            isFetchFailed
              ? "Could not reach Supabase. Check: (1) NEXT_PUBLIC_SUPABASE_URL is correct (https://xxx.supabase.co), (2) project is not paused in Supabase dashboard, (3) network allows supabase.co"
              : msg
          );
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Categories in your order (only those that exist)
  const categories = useMemo(() => {
    const existing = new Set(products.map((p) => safeLabel(p.category)));
    const ordered = CATEGORY_ORDER.filter((c) => existing.has(c));
    return ["All", ...ordered];
  }, [products]);

  // Products sorted by your category order (even in All)
  const filteredProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      const aCat = safeLabel(a.category);
      const bCat = safeLabel(b.category);
      const aIndex = CATEGORY_INDEX.get(aCat) ?? 999;
      const bIndex = CATEGORY_INDEX.get(bCat) ?? 999;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    if (activeCategory === "All") return sorted;
    return sorted.filter((p) => safeLabel(p.category) === activeCategory);
  }, [products, activeCategory, CATEGORY_INDEX]);

  const cartCount = useMemo(() => items.reduce((acc, it) => acc + (it.qty || 0), 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.unit_price * it.qty, 0),
    [items]
  );
  const gst = useMemo(() => subtotal * (1 / 11), [subtotal]); // indicative
  const total = subtotal;

  function handleAdd(product: ProductWithVariants) {
    const vId = selectedVariant[product.id] || product.variants[0]?.id;
    const chosen = product.variants.find((v) => v.id === vId) ?? product.variants[0];
    if (!chosen) return;

    const qty = clampQty(qtyByProduct[product.id] ?? 1);

    addToCart({
      variant_id: chosen.id,
      product_id: product.id,
      sku: chosen.sku, // not shown to user
      name: product.name,
      size: chosen.size,
      unit_price: chosen.price,
      qty,
      image_path: product.image_path ?? null,
      image_alt: product.image_alt ?? null,
      updated_at: product.updated_at ?? null,
    });

    const key = `${product.id}:${chosen.id}`;
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
              <h1 className="text-xl font-black tracking-tight text-gray-900">Order Online</h1>
              <div className="mt-0.5 text-sm text-gray-600">
                Pick size → qty → add to cart
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-700 shadow-sm transition hover:bg-gray-50 active:translate-y-px"
                aria-label="Admin"
              >
                <span className="text-base">⚙</span>
                <span className="hidden sm:inline">Admin</span>
              </Link>
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
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{cartCount}</span>
              </button>
            </div>
          </div>

          {/* Categories: mobile scroll + desktop wrap. (No arrows) */}
          <div className="pb-3">
            <div
              ref={catRowRef}
              className={[
                "-mx-1 flex gap-2 px-1",
                "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "md:flex-wrap md:overflow-visible",
              ].join(" ")}
            >
              {categories.map((c) => {
                const active = c === activeCategory;
                return (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={[
                      "min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition",
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

      {/* Content (pb-24 so floating cart doesn't cover last item) */}
      <div className="mx-auto max-w-4xl px-4 py-6 pb-24">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl sm:rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="aspect-[4/5] bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-3 w-1/4 rounded bg-gray-100" />
                  <div className="h-4 w-3/4 rounded bg-gray-100" />
                  <div className="h-5 w-1/6 rounded bg-gray-100" />
                  <div className="h-3 w-full rounded bg-gray-100" />
                  <div className="h-3 w-2/3 rounded bg-gray-100" />
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="h-10 w-full rounded-xl bg-gray-100" />
                    <div className="flex gap-2">
                      <div className="h-10 w-10 rounded-full bg-gray-100" />
                      <div className="h-10 flex-1 rounded-xl bg-gray-100" />
                    </div>
                  </div>
                </div>
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

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {filteredProducts.map((p) => {
              const vId = selectedVariant[p.id] || p.variants[0]?.id;
              const chosen = p.variants.find((v) => v.id === vId) ?? p.variants[0];
              const fromPrice = Math.min(...p.variants.map((v) => v.price));
              const key = chosen ? `${p.id}:${chosen.id}` : null;
              const justAdded = key ? addedKey === key : false;

              const qty = clampQty(qtyByProduct[p.id] ?? 1);
              const lineTotal = chosen ? chosen.price * qty : fromPrice * qty;

              return (
                <article
                  key={p.id}
                  className="flex flex-col rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md active:shadow-sm overflow-hidden"
                >
                  {/* Image */}
                  <ProductImage
                    imagePath={p.image_path}
                    imageAlt={p.image_alt}
                    name={p.name}
                    updatedAt={p.updated_at}
                    variant="card"
                    onClick={
                      p.image_path
                        ? () =>
                            setImageModal({
                              url: getProductImageUrl(
                                p.image_path!,
                                p.updated_at ? new Date(p.updated_at).getTime() : undefined
                              )!,
                              alt: p.image_alt?.trim() || p.name,
                            })
                        : undefined
                    }
                  />

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-4 min-h-0">
                    <div className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">
                      {safeLabel(p.category)}
                      {p.subcategory ? ` • ${safeLabel(p.subcategory, "")}` : ""}
                    </div>
                    <h3
                      className="mt-1 text-base font-black tracking-tight text-gray-900 line-clamp-2"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-black text-gray-900">{money(fromPrice)}</span>
                      <span className="text-xs text-gray-500 font-medium">+</span>
                    </div>

                    {p.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.description}</p>
                    )}

                    {/* CTA area */}
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <select
                        value={vId}
                        onChange={(e) =>
                          setSelectedVariant((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-extrabold text-gray-900 focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-200"
                        aria-label="Select size"
                      >
                        {p.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {sizeLabel(v.size)}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setQtyByProduct((prev) => ({
                                ...prev,
                                [p.id]: clampQty((prev[p.id] ?? 1) - 1),
                              }))
                            }
                            className="h-10 w-10 rounded-full border border-gray-200 text-base font-black hover:bg-gray-50 active:translate-y-px transition flex items-center justify-center"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="min-w-[2rem] text-center text-sm font-black text-gray-900">
                            {qty}
                          </span>
                          <button
                            onClick={() =>
                              setQtyByProduct((prev) => ({
                                ...prev,
                                [p.id]: clampQty((prev[p.id] ?? 1) + 1),
                              }))
                            }
                            className="h-10 w-10 rounded-full border border-gray-200 text-base font-black hover:bg-gray-50 active:translate-y-px transition flex items-center justify-center"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right min-w-[4.5rem]">
                          <div className="text-sm font-black text-gray-900">{money(lineTotal)}</div>
                          <div className="text-[11px] text-gray-500">total</div>
                        </div>

                        <button
                          onClick={() => handleAdd(p)}
                          className={[
                            "shrink-0 min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:translate-y-px flex-1 min-w-0",
                            justAdded ? "bg-emerald-600" : accentBtn,
                          ].join(" ")}
                        >
                          {justAdded ? "✓" : "+ Add"}
                        </button>
                      </div>

                      <p className="text-[11px] text-gray-500">Prices include GST</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Image modal (tap to expand) */}
      {imageModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setImageModal(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setImageModal(null)}
          aria-label="Close image"
        >
          <button
            type="button"
            onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/90 p-2 text-gray-800 shadow-lg hover:bg-white"
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={imageModal.url}
            alt={imageModal.alt}
            className="max-h-[70vh] max-w-[90vw] sm:max-w-[70vw] w-auto h-auto object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "70vh" }}
          />
        </div>
      )}

      {/* Floating cart pill (mobile) */}
      <button
        onClick={openCart}
        className={[
          "fixed bottom-5 right-5 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-3 text-sm font-extrabold text-white shadow-lg transition active:translate-y-px sm:hidden",
          accentBtn,
        ].join(" ")}
        aria-label="Open cart (floating)"
      >
        🛒
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{cartCount}</span>
      </button>

      {/* CART: Centered modal (mobile + desktop) */}
      <div className={["fixed inset-0 z-50 flex items-center justify-center p-4", isOpen ? "" : "pointer-events-none"].join(" ")}>
        <div
          onClick={closeCart}
          className={[
            "absolute inset-0 bg-black/40 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
        <div
          className={[
            "relative flex w-full max-w-[480px] h-[90vh] max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all",
            "pb-[env(safe-area-inset-bottom,0px)]",
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
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
            onClearItems={clearItems}
            onRemove={removeItem}
            onSetQty={setQty}
          />
        </div>
      </div>
    </div>
  );
}

type CartItemForContent = {
  variant_id: string;
  sku: string;
  name: string;
  size?: string | null;
  unit_price: number;
  qty: number;
  image_path?: string | null;
  image_alt?: string | null;
  updated_at?: string | null;
};

function CartContent(props: {
  items: CartItemForContent[];
  cartCount: number;
  subtotal: number;
  gst: number;
  total: number;
  accentBtn: string;
  onClose: () => void;
  onClear: () => void;
  onClearItems: () => void;
  onRemove: (variant_id: string) => void;
  onSetQty: (variant_id: string, qty: number) => void;
}) {
  const { items, cartCount, subtotal, gst, total, accentBtn, onClose, onClear, onClearItems, onRemove, onSetQty } =
    props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  /* Don't clear successRef when cart empties - we want to show confirmation modal. Only clear on Close. */

  async function placeOrder() {
    setError(null);
    if (items.length === 0) return setError("Your cart is empty.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email.");
    setIsPlacing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim() || null },
          notes: notes.trim() || null,
          items: items.map((it) => ({
            variant_id: it.variant_id,
            qty: it.qty,
            product_name: it.name,
            size: it.size ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Order failed");
      setSuccessRef(data.reference ?? "NCR-XXXX");
      onClearItems();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setIsPlacing(false);
    }
  }

  const previewItem = items.find((it) => it.image_path?.trim());
  const previewUrl = previewItem
    ? getProductImageUrl(
        previewItem.image_path!,
        previewItem.updated_at ? new Date(previewItem.updated_at).getTime() : undefined
      )
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden h-full">
      {/* Full-screen confirmation modal after successful checkout */}
      {successRef && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white p-6">
          <div className="max-w-sm text-center">
            <h2 className="text-xl font-black text-gray-900">
              Order confirmed
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Your order has been received. It will be ready for collection at the next training session.
            </p>
            <p className="mt-4 text-lg font-black text-gray-900">
              Reference: {successRef}
            </p>
            <button
              onClick={() => {
                setSuccessRef(null);
                onClose();
              }}
              className="mt-8 w-full rounded-2xl bg-gray-900 px-4 py-3 font-black text-white transition active:translate-y-px"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="shrink-0 relative h-[min(25dvh,100px)] bg-gray-100">
          <Image
            src={previewUrl}
            alt={previewItem?.image_alt?.trim() || previewItem?.name || "Product"}
            fill
            className="object-contain"
            sizes="480px"
          />
        </div>
      )}

      <div className="shrink-0 border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-gray-500">Your cart</div>
            <div className="text-sm font-black text-gray-900">{cartCount} item(s)</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full bg-gray-900 px-3 py-1.5 text-sm font-bold text-white hover:opacity-90 transition"
            >
              Close ✕
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="px-4 py-3 space-y-4">
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
                    <div className="truncate text-xs text-gray-500">{it.size ?? "One size"}</div>
                  </div>

                  <button
                    onClick={() => onRemove(it.variant_id)}
                    className="rounded-full border border-red-200 px-2.5 py-1 text-sm font-black text-red-600 hover:bg-red-50 transition"
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

        <div className="border-t border-gray-100 pt-4">
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
        <p className="mt-2 text-xs text-gray-600">
          Pickup at the next training session, paying on card only.
        </p>

        {successRef ? null : (
          <>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Email *</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
                  placeholder="04xx xxx xxx"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
                  placeholder="Sizes, comments..."
                  rows={2}
                />
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              <button
                onClick={placeOrder}
                disabled={items.length === 0 || isPlacing}
                className={[
                  "w-full min-h-[44px] rounded-2xl px-4 py-3 font-black text-white transition active:translate-y-px disabled:opacity-50",
                  items.length === 0 ? "bg-gray-300 cursor-not-allowed" : accentBtn,
                ].join(" ")}
              >
                {isPlacing ? "Placing order..." : "Place order"}
              </button>
            </div>
          </>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}