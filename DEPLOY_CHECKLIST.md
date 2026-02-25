# Pre-Vercel Deployment Checklist

## A) Build & Deploy Readiness

### 1. Build verification

```bash
npm run build
```

Must complete without errors. No dev-only assumptions (e.g. `NODE_ENV=development` checks that block production).

### 2. API routes with Node runtime

All routes that use Node APIs (Supabase server client, pdfkit, nodemailer, Buffer) have:

```ts
export const runtime = "nodejs";
```

- `/api/checkout` ✅
- `/api/admin/product-image` ✅
- `/api/admin/orders-monthly-pdf` ✅
- `/api/email-test` ✅ (if using nodemailer)
- All other admin routes ✅

### 3. No Edge runtime

No route uses `export const runtime = "edge"`. Node APIs (Buffer, fs, pdfkit, nodemailer) are not available on Edge.

### 4. Environment variables (production)

Set in Vercel → Project → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL (https://xxx.supabase.co) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service role key (server-only, never expose to client) |
| `SMTP_USER` | Optional | For order confirmation emails |
| `SMTP_PASS` | Optional | SMTP password |
| `ORDERS_TO_EMAILS` | Optional | Comma-separated recipient emails |

Copy from `.env.local.example` as reference. Never commit `.env.local` or real keys.

### 5. Secrets hygiene

- `.env.local` is in `.gitignore` ✅
- `.env.local.example` exists with placeholders only ✅
- No hardcoded secrets in source files (app/, components/, lib/)
- `.next/` is gitignored; it may contain inlined env values from build—do not commit it

### 6. Supabase configuration

- Ensure `product-images` bucket exists and is PUBLIC
- Run migrations: `npx supabase db push` (or apply migration files manually)
- RLS policies allow anon read for products/variants; service role for admin/checkout

---

## B) Local pre-deploy tests

```bash
# Build
npm run build

# Start production server locally
npm run start
```

Then verify:

1. `/` – Homepage loads
2. `/shop` – Products load, categories scroll on mobile
3. `/admin` – Admin panel loads (no auth gate; protect in production if needed)
4. Checkout: add item → Place order → returns reference
5. Admin image upload: upload/replace/remove product image
6. Admin PDF: Download PDF for a month with orders

---

## C) Mobile QA checklist

### Shop page

- [ ] Category row scrolls horizontally on mobile (no arrows)
- [ ] Product cards fit screen width
- [ ] Size selector is usable (touch-friendly)
- [ ] Add feedback visible (checkmark after add)
- [ ] Last product not hidden by floating cart button (`pb-24` on content)

### Cart bottom sheet

- [ ] Sheet scrolls internally when many items (no double scroll with body)
- [ ] Totals and "Place order" always reachable
- [ ] Nothing hidden behind iPhone notch / safe area (bottom padding applied)
- [ ] Body scroll locked when sheet open (no background scrolling)

### Admin (mobile)

- [ ] Basic scrolling works
- [ ] File upload button for product images is tappable
- [ ] Month picker and Download PDF usable

### Tap targets

- [ ] Primary buttons (Add, Place order, categories) ≥ ~44px touch area
- [ ] Floating cart button tappable

### Images

- [ ] Product images load; fallback to initials if missing
- [ ] No layout shift breaking scroll (fixed dimensions or aspect ratio)

---

## D) Vercel deployment steps

1. Connect repo to Vercel
2. Add environment variables (Production, Preview as needed)
3. Build command: `npm run build`
4. Output directory: `.next` (default)
5. Deploy
6. Test live URL on real mobile device

---

## E) Post-deploy checks

- [ ] Checkout returns reference
- [ ] Admin image upload works
- [ ] Monthly PDF generation works
- [ ] No 405/500 on critical routes

---

## F) Admin authentication (HTTP Basic Auth)

### Flow

1. User visits `/admin` or `/api/admin/*`.
2. Middleware checks `Authorization: Basic` header.
3. If missing → 401 with `WWW-Authenticate: Basic realm="NCRUFC Admin"`.
4. Browser prompts for username/password.
5. On retry: middleware decodes credentials, fetches user from Supabase `admin_users`, compares password with bcrypt-edge.
6. If valid and `active=true` → allow. Else → 401.

### Protected routes

- `/admin`, `/admin/*`
- `/api/admin/*` (including product-image, orders-monthly-pdf)

### Seeding bcrypt users

Run the migration:

```bash
npx supabase db push
# or: psql -f supabase/migrations/005_admin_users.sql
```

Migration `005_admin_users.sql` inserts:
- `admin` / `436449`
- `NCRUFC` / `shoponline`

To add users manually (from project root):

```bash
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('YOUR_PASSWORD', 10).then(h => 
  console.log(\"INSERT INTO admin_users (username, password_hash) VALUES ('username', '\" + h + \"');\")
);
"
```

Then run the generated SQL in Supabase SQL Editor.

### Testing checklist

- [ ] **Admin login**: Visit /admin → prompted for credentials → admin/436449 or NCRUFC/shoponline → access granted.
- [ ] **Invalid credentials**: Wrong password → 401, no access.
- [ ] **Checkout modal**: Place order → full-screen confirmation with "Thank you for your order!" and reference → Close → cart closes.
- [ ] **Mobile zoom**: Focus on Name/Email/Phone inputs → no zoom (inputs use text-base / 16px).
- [ ] **Route protection**: /api/admin/orders without Basic auth → 401.
