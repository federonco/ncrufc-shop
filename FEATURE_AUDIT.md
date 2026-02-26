# NCRUFC Shop — Full Feature Audit

## 1) USER (SHOP) FEATURES

### 1.1 User-Facing Functionalities

| Feature | Description | Location |
|--------|-------------|----------|
| **Home redirect** | `/` redirects to `/shop` | `app/page.tsx` |
| **Shop catalog** | Product listing by category with variants (size, price), filter by category | `app/shop/page.tsx` |
| **Category filter** | Horizontal scroll pills (mobile), wrap (desktop). Hardcoded order: Training Tops, Senior Polos, Juniors Playing Shorts, etc. | `app/shop/page.tsx` (CATEGORY_ORDER) |
| **Product display** | Name, category, subcategory, description, price (from-price), size dropdown | `app/shop/page.tsx` |
| **Size selection** | `<select>` per product, options from `product.variants` | `app/shop/page.tsx` |
| **Quantity selection** | ± buttons, clamped 1–99 | `app/shop/page.tsx` (clampQty) |
| **Add to cart** | Adds variant to cart with chosen qty. Shows "✓" feedback for 700ms | `app/shop/page.tsx` (handleAdd) |
| **Admin link** | Link to `/admin` in header (always visible) | `app/shop/page.tsx` |
| **Cart button** | Sticky header + floating pill (mobile) with item count | `app/shop/page.tsx` |
| **Image modal** | Full-screen overlay on product image click. Close via backdrop, X button, or Escape | `app/shop/page.tsx` |
| **Footer** | AppFooter with "Created by readX™", version, All rights Reserved | `components/AppFooter.tsx` |

### 1.2 Cart Behavior

| Aspect | Implementation |
|--------|----------------|
| **State** | Zustand store (`hooks/use-cart.ts`): `items`, `isOpen` |
| **Persistence** | In-memory only (lost on page reload) |
| **Add item** | If variant already in cart, adds to existing qty. Validates `variant_id`, `unit_price`, `qty` |
| **Remove item** | By `variant_id` |
| **Set qty** | `setQty(variant_id, qty)`. If qty ≤ 0, removes item |
| **Clear** | `clear()` clears items and closes cart; `clearItems()` clears items only |
| **Open/close** | `open()` / `close()` toggle modal |
| **UI** | Inline `CartContent` in shop page (centered modal, not sidebar). Items + form in single scrollable area |
| **Duplicate handling** | Same variant_id adds to qty (merge) |

### 1.3 Checkout Flow

| Step | Behavior |
|------|----------|
| **1. Cart modal** | User opens cart via header or floating button |
| **2. Form fields** | Name * (required), Email * (required), Phone (optional), Notes (optional) |
| **3. Validation** | Client: empty cart, missing name/email → `setError()` |
| **4. Submit** | POST `/api/checkout` with `{ customer: { name, email, phone }, notes, items: [{ variant_id, qty, product_name, size }] }` |
| **5. Server** | Resolves prices from DB (never trusts client). Creates order + order_items. Optional email via SMTP |
| **6. Success** | Modal shows "Order confirmed" + reference (e.g. NCR-XXXXXX). Cart cleared via `clearItems()` |
| **7. Pickup note** | "Pickup at the next training session, paying on card only." |

**Note:** `components/cart-modal.tsx` exists but uses `/api/orders` (different payload). The shop page uses inline `CartContent` and `/api/checkout`. `cart-modal.tsx` appears unused/legacy.

### 1.4 Image Handling

| Aspect | Details |
|--------|---------|
| **Source** | `products.image_path` or first image from `product_images` |
| **URL** | `getProductImageUrl(path, version)` → Supabase public storage URL + optional `?v=` cache bust |
| **Fallback** | Product initials (2 letters) when no image |
| **Display** | Next.js `Image` component, lazy loading, 48×48 thumbnails in shop |
| **Modal** | Click product image → full-screen overlay with larger image |
| **Cache bust** | `updated_at` timestamp used as version when available |

### 1.5 Validations

| Context | Validation |
|---------|------------|
| **Add to cart** | `variant_id`, `unit_price`, `qty` must be valid; qty clamped 1–99 |
| **Checkout form** | Name and email required; empty cart rejected |
| **Checkout API** | `customer.name`, `customer.email` required; `items` non-empty array; variant_id lookup; price from DB |
| **Shop data** | Only `active` products and variants shown |

### 1.6 Error Handling

| Context | Behavior |
|---------|----------|
| **Product load** | Supabase errors → `setError()`. Fetch/network errors show Supabase URL/pause hint |
| **Checkout** | API error → `setError()`, user sees message |
| **Cart** | Invalid add silently ignored (guard in `add()`) |
| **Image** | Fallback to initials if no URL |
| **Modal** | Dismissable error banner with "Dismiss" |

---

## 2) ADMIN FEATURES

### 2.1 Login / Auth Logic

| Aspect | Implementation |
|--------|----------------|
| **Route** | `/admin/login` — custom form (username, password) |
| **Auth flow** | POST `/api/admin/login` with JSON `{ username, password }`. If valid, sets `admin_session` cookie, redirects to `/admin` |
| **Session cookie** | HMAC-SHA256 signed payload `timestamp.signature`. HttpOnly, SameSite=Lax, Secure in prod |
| **Session modes** | `ADMIN_SESSION_MODE`: `always` | `ttl` | `session`. Default `ttl`. `ADMIN_SESSION_TTL_SECONDS` default 600 |
| **Middleware** | Protects `/admin`, `/admin/*`, `/api/admin/*`. Allows `/admin/login` and POST `/api/admin/login` without auth |
| **Fallback** | If no cookie/Basic: page routes → redirect to `/admin/login`; API routes → 401 + WWW-Authenticate Basic |
| **Basic Auth** | Supported for API (e.g. curl). Creates session cookie when `ADMIN_SESSION_SECRET` set |
| **Logout** | POST `/api/admin/logout` clears cookie. UI: "Exit admin / Back to shop" button |
| **Credential storage** | Passwords never stored client-side; validated against `admin_users.password_hash` (bcrypt) |

### 2.2 Dashboard Elements

| Section | Description |
|---------|-------------|
| **Revenue (monthly)** | Month picker. Shows: Revenue (paid), Potential (unpaid), Orders count, Paid/Unpaid counts |
| **Unpaid Orders** | Collapsible. List of unpaid, non-cancelled orders. Actions: Mark paid, Cancel (2-step), Delete |
| **Stock** | Collapsible. Category filter, "Only stock < 5" toggle, Stock PDF download. Grouped by category → product → variants |
| **Orders Records** | Collapsible. Month picker, Orders PDF download, table with Date, Ref, Customer, Total, Status, Delete |
| **Error banner** | Dismissable red banner for API/load errors |

### 2.3 Orders Management

| Action | Endpoint | Behavior |
|--------|----------|----------|
| **List** | GET `/api/admin/orders?month=YYYY-MM&limit=50` | Returns orders + itemsByOrder |
| **Mark paid** | POST `/api/admin/orders/[id]/pay` | Calls RPC `pay_order(p_order_id)` → sets `paid_at` |
| **Cancel** | POST `/api/admin/orders/[id]/cancel` | Updates `status` to `cancelled` |
| **Delete** | DELETE `/api/admin/orders/[id]/delete` | Deletes order_items then order. Requires confirmation modal |
| **Delete modal** | Inline `DeleteConfirmModal` | "Order X will be permanently deleted. This cannot be undone." |

### 2.4 Stock Management

| Action | Endpoint | Behavior |
|--------|----------|----------|
| **List** | GET `/api/admin/stock?low=true|false` | Grouped by category. Optionally filter variants with stock < 5 |
| **Update variant** | PATCH `/api/admin/variants/[id]` | Body: `{ stock?: number, price?: number }` |
| **UI** | Inline table per product: Size, Stock (+/−), Price, Save button | Stock/price edited inline, Save sends PATCH |
| **Low stock** | Red badge "X low" on category when any variant < 5 | `lowStockByCategory` memo |

### 2.5 Image Upload Logic

| Aspect | Details |
|--------|---------|
| **Component** | `ProductImageUpload` (admin/page.tsx) |
| **Max images** | 5 per product |
| **Client compression** | `browser-image-compression`: maxSizeMB 0.5, maxWidthOrHeight 1200, fileType WebP, initialQuality 0.8 |
| **Pre-upload** | Reject files > 5MB. Types: JPEG, PNG, WebP |
| **Flow** | 1) Validate 2) Compress → WebP 3) Upload via FormData to `/api/admin/product-image` |
| **Remove** | DELETE with `{ product_id, path }`. Confirms with browser `confirm()` |
| **Feedback** | Spinner during upload; "Uploaded" / "Removed" message; dev console logs original vs compressed size |

### 2.6 PDF Reports

| Report | Route | Content |
|--------|-------|---------|
| **Orders monthly** | GET `/api/admin/orders-monthly-pdf?year=YYYY&month=M` | Table: Date, Reference, Customer, Email, Total, Paid?, Status. Footer: readX, version |
| **Stock list** | GET `/api/admin/stock-pdf` | Table: Product, Size, SKU, Stock, Price. Footer: readX, version |
| **Auth** | Requires admin session cookie (credentials: include) |
| **Format** | PDFKit, A4, binary response |

### 2.7 Delete Behavior

| Entity | Flow |
|--------|------|
| **Order** | User clicks Delete → `DeleteConfirmModal` → confirm → DELETE `/api/admin/orders/[id]/delete` |
| **Product image** | User clicks Remove → `confirm("Remove this image?")` → DELETE `/api/admin/product-image` |
| **Order delete** | order_items deleted first, then order. No soft delete |
| **Image delete** | Row removed from `product_images`, file removed from Supabase Storage |

### 2.8 Security Rules

| Rule | Implementation |
|------|----------------|
| **Admin routes** | Middleware enforces auth (cookie or Basic) |
| **Cookie** | HttpOnly, Secure in prod, SameSite=Lax, path=/ |
| **Session verification** | HMAC signature checked; TTL enforced in `ttl` mode |
| **Password** | bcrypt compare; never sent after login except on re-auth |
| **API** | All `/api/admin/*` protected by same middleware |
| **Supabase** | Server uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) |

---

## 3) API ROUTES

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| **`/api/checkout`** | GET | None | Health check: "Checkout API ready. POST with customer + items." |
| **`/api/checkout`** | POST | None | Creates order + order_items. Validates customer, resolves prices from DB. Sends email. Returns `{ ok, reference, order_id }` |
| **`/api/orders`** | POST | None | Legacy checkout endpoint. Trusts client prices. Creates order + items, sends email. Returns `{ ok, reference }` |
| **`/api/env-check`** | GET | None | Debug: returns envPath, envFileExists, SMTP vars, NODE_ENV |
| **`/api/email-test`** | GET | None | Sends test email via `sendOrderEmail`. Requires SMTP configured |
| **`/api/admin/login`** | POST | None | Validates username/password, sets admin_session cookie |
| **`/api/admin/logout`** | POST | Admin | Clears admin_session cookie |
| **`/api/admin/stock`** | GET | Admin | Returns grouped stock data (category → product → variants) |
| **`/api/admin/stock-pdf`** | GET | Admin | Returns Stock List PDF |
| **`/api/admin/orders`** | GET | Admin | Returns orders + itemsByOrder for month |
| **`/api/admin/orders-monthly-pdf`** | GET | Admin | Returns Monthly Orders Report PDF |
| **`/api/admin/revenue`** | GET | Admin | Returns revenue, potentialRevenue, ordersCount, paidCount, unpaidCount for month |
| **`/api/admin/variants/[id]`** | PATCH | Admin | Updates variant stock and/or price |
| **`/api/admin/orders/[id]/pay`** | POST | Admin | Marks order as paid via RPC |
| **`/api/admin/orders/[id]/cancel`** | POST | Admin | Sets order status to cancelled |
| **`/api/admin/orders/[id]/delete`** | DELETE | Admin | Deletes order and order_items |
| **`/api/admin/product-image`** | POST | Admin | Upload product image (multipart). Max 5 per product, 2MB |
| **`/api/admin/product-image`** | DELETE | Admin | Remove product image (body or query: product_id, path) |

---

## 4) DATABASE STRUCTURE

### Tables (inferred from migrations and code)

| Table | Columns / Notes | Relationships |
|-------|-----------------|---------------|
| **`products`** | id, name, description, category, subcategory, sort_order, active, image_path, image_alt, updated_at | Referenced by product_variants, product_images |
| **`product_variants`** | id, product_id, sku, size, price, stock, active | product_id → products.id |
| **`product_images`** | id, product_id, path, sort_order | product_id → products.id ON DELETE CASCADE |
| **`orders`** | id, reference, customer_name, customer_email, customer_phone, notes, subtotal, gst, total, status, paid_at, created_at | Referenced by order_items |
| **`order_items`** | id, order_id, product_id, variant_id, sku, name, size, unit_price, qty, line_total | order_id → orders.id; product_id → products.id; variant_id → product_variants.id |
| **`admin_users`** | id, username, password_hash, active, created_at | Standalone |

### Constraints (from migrations)

- `product_variants.stock` ≥ 0
- `product_images.product_id` ON DELETE CASCADE
- `pay_order(uuid)` RPC: SECURITY DEFINER, sets paid_at

### Supabase Storage

- **Bucket:** `product-images` (public)
- **Path pattern:** `products/{product_id}/img_{count}.{ext}`

---

## 5) ENVIRONMENT VARIABLES

| Variable | Required | Description |
|----------|----------|-------------|
| **NEXT_PUBLIC_SUPABASE_URL** | Yes | Supabase project URL (e.g. https://xxx.supabase.co) |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Yes | Supabase anon/public key (client) |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes | Supabase service_role key (server) |
| **SMTP_USER** | For email | Gmail SMTP user |
| **SMTP_PASS** | For email | Gmail SMTP password / app password |
| **ORDERS_TO_EMAILS** | For email | Comma-separated recipient emails for order notifications |
| **ADMIN_SESSION_SECRET** | For admin | Secret for signing session cookie. If unset, no session cookie (Basic Auth only) |
| **ADMIN_SESSION_MODE** | Optional | `always` \| `ttl` \| `session`. Default: `ttl` |
| **ADMIN_SESSION_TTL_SECONDS** | Optional | Session TTL when mode=ttl. Default: 600 |

---

## Notes

- **cart-modal.tsx** uses `/api/orders` and appears legacy; shop uses inline CartContent + `/api/checkout`.
- **lib/products.ts** defines `fetchShopRows()` but shop page fetches directly via Supabase client.
- Base schema for `products`, `product_variants`, `orders`, `order_items` is assumed to exist (not in provided migrations).
