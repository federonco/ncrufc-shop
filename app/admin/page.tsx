"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getProductImageUrl } from "@/lib/product-image";

function money(n: number) {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

type VariantRow = {
  id: string;
  sku: string;
  size: string | null;
  price: number;
  stock: number;
};

type ProductGroup = {
  id: string;
  name: string;
  subcategory: string | null;
  image_path: string | null;
  image_alt: string | null;
  variants: VariantRow[];
};

type CategoryGroup = {
  category: string;
  products: ProductGroup[];
};

export default function AdminPage() {
  const [stockData, setStockData] = useState<{ grouped: CategoryGroup[] } | null>(null);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockFilterLow, setStockFilterLow] = useState(true);
  const [stockCategory, setStockCategory] = useState<string>("");
  const [revenue, setRevenue] = useState<{
    month: string;
    revenue: number;
    potentialRevenue: number;
    ordersCount: number;
    paidCount: number;
    unpaidCount: number;
  } | null>(null);
  const [revenueMonth, setRevenueMonth] = useState(
    () => new Date().toISOString().slice(0, 7)
  );
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      reference: string;
      customer_name: string;
      customer_email?: string;
      total: number;
      paid_at: string | null;
      status?: string;
      created_at: string;
    }>
  >([]);
  const [itemsByOrder, setItemsByOrder] = useState<
    Record<
      string,
      Array<{ name: string; size: string | null; qty: number; line_total: number }>
    >
  >({});
  const [ordersMonth, setOrdersMonth] = useState(
    () => new Date().toISOString().slice(0, 7)
  );
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingVariant, setUpdatingVariant] = useState<string | null>(null);
  const [payingOrder, setPayingOrder] = useState<string | null>(null);
  const [confirmingCancelOrder, setConfirmingCancelOrder] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetch(
        `/api/admin/stock?low=${stockFilterLow}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setStockData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stock");
    } finally {
      setStockLoading(false);
    }
  }, [stockFilterLow]);

  const loadRevenue = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/revenue?month=${revenueMonth}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setRevenue(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load revenue");
    }
  }, [revenueMonth]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch(
        `/api/admin/orders?month=${ordersMonth}&limit=50`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setOrders(data.orders ?? []);
      setItemsByOrder(data.itemsByOrder ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }, [ordersMonth]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function updateVariant(
    id: string,
    updates: { stock?: number; price?: number }
  ) {
    setUpdatingVariant(id);
    try {
      const res = await fetch(`/api/admin/variants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Update failed");
      await loadStock();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingVariant(null);
    }
  }

  async function markPaid(orderId: string) {
    setPayingOrder(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/pay`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Mark paid failed");
      await loadOrders();
      await loadRevenue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark paid failed");
    } finally {
      setPayingOrder(null);
    }
  }

  async function markCancelled(orderId: string) {
    setConfirmingCancelOrder(null);
    setCancellingOrder(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Cancel failed");
      await loadOrders();
      await loadRevenue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingOrder(null);
    }
  }

  const accentBtn = "bg-orange-500 hover:bg-orange-600 text-white shadow-sm active:translate-y-px transition";

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">Admin</h1>
              <Link
                href="/shop"
                className="text-sm text-gray-500 hover:text-orange-600 transition"
              >
                ← Back to shop
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Revenue */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
          <h2 className="text-lg font-black text-gray-900">Revenue (monthly)</h2>
          <p className="mt-1 text-xs text-gray-500">
            Revenue = paid orders only. Potential = unpaid orders.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={revenueMonth}
              onChange={(e) => setRevenueMonth(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:outline-none transition"
            />
          </div>
          {revenue && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="text-xs font-bold text-emerald-600">Revenue (paid)</div>
                <div className="text-2xl font-black text-emerald-700">
                  {money(revenue.revenue)}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <div className="text-xs font-bold text-amber-600">Potential (unpaid)</div>
                <div className="text-2xl font-black text-amber-700">
                  {money(revenue.potentialRevenue ?? 0)}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-xs font-bold text-gray-500">Orders</div>
                <div className="text-2xl font-black">{revenue.ordersCount}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-xs font-bold text-gray-500">Paid / Unpaid</div>
                <div className="text-2xl font-black">
                  {revenue.paidCount} / {revenue.unpaidCount}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Unpaid orders dashboard */}
        {orders.filter((o) => !o.paid_at && o.status !== "cancelled").length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-md">
            <h2 className="text-lg font-black text-amber-800">Unpaid orders</h2>
            <p className="mt-1 text-sm text-amber-700">
              Confirm payment received and mark as paid.
            </p>
            <div className="mt-4 space-y-3">
              {orders
                .filter((o) => !o.paid_at && o.status !== "cancelled")
                .map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white p-4"
                  >
                    <div>
                      <div className="font-black text-gray-900">{o.reference}</div>
                      <div className="text-sm text-gray-600">
                        {o.customer_name} · {money(o.total)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Mark order ${o.reference} (${money(o.total)}) as paid?`
                            )
                          ) {
                            markPaid(o.id);
                          }
                        }}
                        disabled={payingOrder === o.id || cancellingOrder === o.id}
                        className={`rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50 ${accentBtn}`}
                      >
                        {payingOrder === o.id ? "…" : "Mark paid"}
                      </button>
                      {confirmingCancelOrder === o.id ? (
                        <button
                          onClick={() => markCancelled(o.id)}
                          disabled={cancellingOrder === o.id}
                          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-amber-900 shadow-sm hover:bg-amber-500 disabled:opacity-50 transition"
                        >
                          {cancellingOrder === o.id ? "…" : "Confirm?"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmingCancelOrder(o.id)}
                          disabled={payingOrder === o.id || cancellingOrder === o.id}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Stock */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
          <h2 className="text-lg font-black text-gray-900">Stock</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <select
              value={stockCategory}
              onChange={(e) => setStockCategory(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:outline-none transition"
            >
              <option value="">All categories</option>
              {stockData?.grouped?.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stockFilterLow}
                onChange={(e) => setStockFilterLow(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Only stock &lt; 5</span>
            </label>
          </div>
          {stockLoading ? (
            <div className="mt-6 text-gray-500">Loading…</div>
          ) : stockData?.grouped?.length === 0 ? (
            <div className="mt-6 text-gray-500">
              No variants match the filter.
            </div>
          ) : (
            <div className="mt-4 space-y-6">
                    {stockData?.grouped
                ?.filter((cat) => !stockCategory || cat.category === stockCategory)
                .map((cat) => (
                <div key={cat.category}>
                  <h3 className="font-bold text-gray-700">{cat.category}</h3>
                  <div className="mt-2 space-y-3">
                    {cat.products.map((prod) => (
                      <div
                        key={prod.id}
                        className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow transition"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <ProductImageUpload
                            productId={prod.id}
                            productName={prod.name}
                            imagePath={prod.image_path}
                            onSuccess={loadStock}
                            onError={setError}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-gray-900">{prod.name}</div>
                            <div className="mt-2 overflow-x-auto">
                              <table className="w-full min-w-[400px] text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500">
                                    <th className="py-1 pr-2">Size</th>
                                    <th className="py-1 pr-2">SKU</th>
                                    <th className="py-1 pr-2">Stock</th>
                                    <th className="py-1 pr-2">Price</th>
                                    <th className="py-1">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {prod.variants.map((v) => (
                                    <InlineVariantRow
                                      key={v.id}
                                      variant={v}
                                      onUpdate={updateVariant}
                                      updating={updatingVariant === v.id}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Orders */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
          <h2 className="text-lg font-black text-gray-900">Orders</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={ordersMonth}
              onChange={(e) => setOrdersMonth(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:outline-none transition"
            />
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 transition ${accentBtn}`}
              onClick={async () => {
                const [y, m] = ordersMonth.split("-").map(Number);
                const url = `/api/admin/orders-monthly-pdf?year=${y}&month=${m}`;
                try {
                  const res = await fetch(url);
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error ?? "Failed to generate PDF");
                  }
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = blobUrl;
                  a.download = `orders-${y}-${String(m).padStart(2, "0")}.pdf`;
                  a.click();
                  URL.revokeObjectURL(blobUrl);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to generate PDF");
                }
              }}
            >
              Download PDF
            </button>
          </div>
          {ordersLoading ? (
            <div className="mt-6 text-gray-500">Loading…</div>
          ) : (
            <div className="mt-4 space-y-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-gray-900">
                        {o.reference}
                        {o.paid_at ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            Paid
                          </span>
                        ) : o.status === "cancelled" ? (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                            Cancelled
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                            Unpaid
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {o.customer_name} · {o.customer_email ?? ""}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(o.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900">
                        {money(o.total)}
                      </span>
                      {!o.paid_at && o.status !== "cancelled" && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Mark order ${o.reference} (${money(o.total)}) as paid?`
                              )
                            ) {
                              markPaid(o.id);
                            }
                          }}
                          disabled={payingOrder === o.id || cancellingOrder === o.id}
                          className={`rounded-lg px-3 py-1.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 ${accentBtn}`}
                        >
                          {payingOrder === o.id ? "…" : "Mark paid"}
                        </button>
                      )}
                      {o.status !== "cancelled" && (
                        confirmingCancelOrder === o.id ? (
                          <button
                            onClick={() => markCancelled(o.id)}
                            disabled={cancellingOrder === o.id}
                            className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-amber-900 shadow-sm hover:bg-amber-500 disabled:opacity-50 transition"
                          >
                            {cancellingOrder === o.id ? "…" : "Confirm?"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmingCancelOrder(o.id)}
                            disabled={payingOrder === o.id || cancellingOrder === o.id}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                          >
                            Cancel
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
                    {(itemsByOrder[o.id] ?? []).map((it, i) => (
                      <li key={i}>
                        {it.qty}× {it.name}
                        {it.size ? ` (${it.size})` : ""} — {money(it.line_total)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {orders.length === 0 && !ordersLoading && (
                <div className="text-gray-500">No orders for this month.</div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ProductImageUpload({
  productId,
  productName,
  imagePath,
  onSuccess,
  onError,
}: {
  productId: string;
  productName: string;
  imagePath: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const imageUrl = imagePath ? getProductImageUrl(imagePath, imageVersion ?? undefined) : null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      onError("File too large. Max 4MB.");
      return;
    }
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!ok) {
      onError("Use JPEG, PNG, or WebP.");
      return;
    }
    e.target.value = "";
    setMsg(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("product_id", productId);
      formData.set("file", file);
      const res = await fetch("/api/admin/product-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      if (typeof data.version === "number") setImageVersion(data.version);
      setMsg("Uploaded");
      onSuccess();
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove this image?")) return;
    setMsg(null);
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/admin/product-image?product_id=${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Remove failed");
      setMsg("Removed");
      onSuccess();
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  }

  function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "?";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="relative h-20 w-20 overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-100 shadow-inner">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-black text-gray-400">
            {initials(productName)}
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || removing}
          className="rounded-lg bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition active:translate-y-px"
        >
          {uploading ? "…" : imageUrl ? "Replace" : "Upload"}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading || removing}
            className="rounded-lg border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
          >
            Remove
          </button>
        )}
      </div>
      {msg && (
        <span className="text-[10px] text-emerald-600">{msg}</span>
      )}
      <span className="text-[9px] text-gray-400">Tip: upload webp for best quality/size</span>
    </div>
  );
}

function InlineVariantRow({
  variant,
  onUpdate,
  updating,
}: {
  variant: VariantRow;
  onUpdate: (id: string, u: { stock?: number; price?: number }) => void;
  updating: boolean;
}) {
  const [stockVal, setStockVal] = useState(variant.stock);
  const [priceVal, setPriceVal] = useState(variant.price.toFixed(2));

  React.useEffect(() => {
    setStockVal(variant.stock);
    setPriceVal(variant.price.toFixed(2));
  }, [variant.id, variant.stock, variant.price]);
  const hasChanges =
    stockVal !== variant.stock ||
    Math.abs(parseFloat(priceVal) - variant.price) > 0.001;

  function incrementStock() {
    setStockVal((v) => Math.max(0, v + 1));
  }
  function decrementStock() {
    setStockVal((v) => Math.max(0, v - 1));
  }

  function handleSave() {
    const stock = Math.max(0, Math.floor(stockVal));
    const price = parseFloat(priceVal);
    if (!Number.isNaN(price) && price >= 0) {
      onUpdate(variant.id, { stock, price });
    }
  }

  return (
    <tr>
      <td className="py-2 pr-2">{variant.size ?? "—"}</td>
      <td className="py-2 pr-2 font-mono text-xs">{variant.sku || "—"}</td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={decrementStock}
            disabled={updating}
            className="h-8 w-8 shrink-0 rounded-full border border-gray-200 text-center text-lg leading-none hover:bg-gray-100 hover:border-gray-300 disabled:opacity-50 transition"
            aria-label="Decrease stock"
          >
            −
          </button>
          <input
            type="number"
            min={0}
            value={stockVal}
            onChange={(e) => setStockVal(Math.max(0, parseInt(e.target.value, 10) || 0))}
            disabled={updating}
            className="w-14 rounded border border-gray-200 px-1 py-1 text-right text-sm"
          />
          <button
            type="button"
            onClick={incrementStock}
            disabled={updating}
            className="h-8 w-8 shrink-0 rounded-full border border-gray-200 text-center text-lg leading-none hover:bg-gray-100 hover:border-gray-300 disabled:opacity-50 transition"
            aria-label="Increase stock"
          >
            +
          </button>
        </div>
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min={0}
          step={0.01}
          value={priceVal}
          onChange={(e) => setPriceVal(e.target.value)}
          disabled={updating}
          className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm"
        />
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={updating || !hasChanges}
          className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition active:translate-y-px"
        >
          {updating ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
