# Product Images Bucket Setup

Create the storage bucket in Supabase:

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **Storage** → **New bucket**
3. Name: `product-images`
4. Enable **Public bucket** (so images are served without signed URLs)
5. Click **Create bucket**

Optional: Add a storage policy to restrict uploads (admin uses service role, which bypasses RLS). For public read:

- Policy: Allow public SELECT (read) on `product-images`
- Supabase public buckets are readable by default; uploads use the service role from the API.
