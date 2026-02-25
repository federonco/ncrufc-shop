# Checkout Flow Audit Report

**Date:** 2025-02-25  
**Project:** NCRUFC Shop (North Coast Junior RUFC)

---

## 1. Files Inspected

| File | Purpose |
|------|---------|
| `app/api/orders/route.ts` | Legacy orders API (POST) – uses flat customer fields |
| `app/api/checkout/route.ts` | **NEW** – Canonical checkout API |
| `app/shop/page.tsx` | Shop + CartContent (bottom sheet) |
| `components/cart-modal.tsx` | Unused – full checkout form, POST to /api/orders |
| `hooks/use-cart.ts` | Zustand cart store (variant_id, product_id, sku, name, size, unit_price, qty) |
| `models/cart-item.ts` | Alternate type (sku, size, name, price, qty) – not used by shop |
| `lib/supabase/client.ts` | Anon key client |
| `lib/supabase/server.ts` | Service role client (SUPABASE_SERVICE_ROLE_KEY) |
| `lib/email.ts` | Nodemailer – throws if SMTP vars missing |

---

## 2. Inconsistencies Found

### Routing
- **No `/api/checkout` existed** – checkout was previously via `/api/orders` or an alert placeholder.
- **CartContent** had Checkout button that only showed `alert("Next step: create order + send email ✅")` – no real submission.
- **CartModal** has full checkout form + POST to `/api/orders` but is **never imported/rendered** anywhere.

### Payload / Types
- **Legacy `/api/orders`** expects: `customer_name`, `customer_email`, `customer_phone`, `notes`, `items` (product_id, variant_id, sku, name, size, unit_price, qty).
- **New canonical contract** uses: `customer: { name, email, phone? }`, `notes?`, `items: [{ variant_id, qty, product_name?, size? }]`.
- **Zustand cart** stores: `variant_id`, `product_id`, `sku`, `name`, `size`, `unit_price`, `qty` – all snake_case.
- **models/cart-item.ts** uses different shape (`price` vs `unit_price`, no `variant_id`) – not used by shop.

### DB / Backend
- **orders** table: `reference`, `customer_name`, `customer_email`, `customer_phone`, `notes`, `subtotal`, `gst`, `total`, `status`.
- **order_items** table: `order_id`, `product_id`, `variant_id`, `sku`, `name`, `size`, `unit_price`, `qty`, `line_total`.
- **product_variants**: `id`, `product_id`, `sku`, `size`, `price`, `active`.
- User reported `customer_name` null – caused by client sending `customer: { name, email }` while backend expected flat `customer_name`.

### Email
- `sendOrderEmail` throws if `SMTP_USER`, `SMTP_PASS`, or `ORDERS_TO_EMAILS` missing.
- Checkout must not fail when email env vars are absent.

---

## 3. Changes Made

| Change | File |
|--------|------|
| **Created** canonical checkout API | `app/api/checkout/route.ts` |
| Parse `customer: { name, email, phone? }` → `customer_name`, `customer_email`, `customer_phone` | `app/api/checkout/route.ts` |
| Resolve variant prices from `product_variants` (do not trust client) | `app/api/checkout/route.ts` |
| Wrap email in try/catch – don’t block checkout on failure | `app/api/checkout/route.ts` |
| Add checkout form + `placeOrder` to CartContent | `app/shop/page.tsx` |
| POST to `/api/checkout` with canonical payload | `app/shop/page.tsx` |
| Success state: show reference + Done, clear cart | `app/shop/page.tsx` |
| Minor: `?? ""` for env in email (reduces noise; throw still present) | `lib/email.ts` |

---

## 4. Canonical Payload Contract

```json
{
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "0412345678"
  },
  "notes": "Pickup Tuesday",
  "items": [
    { "variant_id": "uuid-here", "qty": 2, "product_name": "Training Top", "size": "M" }
  ]
}
```

- **Required:** `customer.name`, `customer.email`, `items` (non-empty).
- **Backend:** Resolves `product_id`, `sku`, `price`, `product_name` from DB per `variant_id`. Ignores client-provided prices.

---

## 5. Pending Roadmap (Not Implemented)

1. **Stock decrement** – Schema not fully inspected. Need to identify table/column for stock and implement safe decrement (RPC or transaction).
2. **Admin panel** – Referenced in context but `/admin` and `/api/admin` not present in repo.
3. **CartModal** – Unused; consider removing or integrating.

---

## 6. How to Test

### Local dev

1. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Optional: `SMTP_USER`, `SMTP_PASS`, `ORDERS_TO_EMAILS` (comma-separated)

2. Run:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000/shop`.

### Sample request (curl)

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer": { "name": "Test User", "email": "test@example.com", "phone": "0412345678" },
    "notes": "Test order",
    "items": [
      { "variant_id": "<valid-variant-uuid>", "qty": 1 }
    ]
  }'
```

Replace `<valid-variant-uuid>` with an actual `product_variants.id` from Supabase.

### Expected response

```json
{
  "ok": true,
  "reference": "NCR-ABC123",
  "order_id": "uuid-of-order"
}
```

### Verify in Supabase

1. **orders**: New row with `customer_name`, `customer_email`, `reference`, `status = 'submitted'`, `total`.
2. **order_items**: Rows with `order_id`, `variant_id`, `product_id`, `qty`, `unit_price`, `line_total`.

### GET (quick test)

```bash
curl http://localhost:3000/api/checkout
# → { "ok": true, "message": "Checkout API ready. POST with customer + items." }
```

---

## 7. Reference / DB Note

The checkout route **passes** `reference` in the insert (format `NCR-XXXXXX`). If your Supabase `orders.reference` has a DEFAULT (e.g. sequence `NCR-000001`, `NCR-000002`), you may prefer to omit `reference` from the insert and let the DB generate it. In that case, remove the `reference` field from the `insert()` call in `app/api/checkout/route.ts`.
