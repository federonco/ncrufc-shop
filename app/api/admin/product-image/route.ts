export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getProductImageUrl } from "@/lib/product-image";

const BUCKET = "product-images";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_IMAGES_PER_PRODUCT = 5;

/** POST: Upload product image. Body: multipart/form-data with product_id + file. Up to 5 images per product. */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const productId = formData.get("product_id")?.toString()?.trim();
    const file = formData.get("file") as File | null;

    if (!productId) {
      return NextResponse.json({ error: "product_id required" }, { status: 400 });
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, or WebP. Max 2MB." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 2MB. Use WebP for best compression." },
        { status: 400 }
      );
    }

    const sb = supabaseServer();

    const { data: existing } = await sb
      .from("product_images")
      .select("id")
      .eq("product_id", productId);

    const count = (existing ?? []).length;
    if (count >= MAX_IMAGES_PER_PRODUCT) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_PRODUCT} images per product. Remove one first.` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : "jpg";
    const storagePath = `products/${productId}/img_${count}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json(
        { error: uploadErr.message ?? "Upload failed" },
        { status: 500 }
      );
    }

    const { error: insertErr } = await sb
      .from("product_images")
      .insert({ product_id: productId, path: storagePath, sort_order: count });

    if (insertErr) {
      console.error("product_images insert error:", insertErr);
      await sb.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: insertErr.message ?? "Failed to save image record" },
        { status: 500 }
      );
    }

    const version = Date.now();
    const publicUrl = getProductImageUrl(storagePath);
    return NextResponse.json({
      ok: true,
      product_id: productId,
      image_path: storagePath,
      public_url: publicUrl,
      version,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE: Remove product image. Query: product_id + path, or JSON body: { product_id, path } */
export async function DELETE(req: Request) {
  try {
    let productId: string | null = null;
    let path: string | null = null;
    try {
      const body = await req.json().catch(() => null);
      const b = body as { product_id?: string; path?: string } | null;
      productId = b?.product_id?.trim() ?? null;
      path = b?.path?.trim() ?? null;
    } catch {
      /* no body */
    }
    if (!productId || !path) {
      const { searchParams } = new URL(req.url);
      productId = productId ?? searchParams.get("product_id")?.trim() ?? null;
      path = path ?? searchParams.get("path")?.trim() ?? null;
    }

    if (!productId) {
      return NextResponse.json({ error: "product_id required" }, { status: 400 });
    }
    if (!path) {
      return NextResponse.json({ error: "path required (image to remove)" }, { status: 400 });
    }

    const sb = supabaseServer();

    const { error: deleteErr } = await sb
      .from("product_images")
      .delete()
      .eq("product_id", productId)
      .eq("path", path);

    if (deleteErr) throw deleteErr;

    await sb.storage.from(BUCKET).remove([path]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
