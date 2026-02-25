/**
 * Build public URL for product image stored in Supabase Storage.
 * Bucket: product-images (public)
 * @param version - optional cache-bust query param (?v=...)
 */
export function getProductImageUrl(
  imagePath: string | null | undefined,
  version?: number | string | null
): string | null {
  if (!imagePath?.trim()) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  let url = `${base}/storage/v1/object/public/product-images/${imagePath}`;
  if (version != null && version !== "") {
    url += `?v=${encodeURIComponent(String(version))}`;
  }
  return url;
}
