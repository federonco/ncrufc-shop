export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getProductImageUrl } from "@/lib/product-image";

const BUCKET = "product-images";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

/** POST: Upload product image. Body: multipart/form-data with product_id + file */
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
        { error: "Invalid file type. Use JPEG, PNG, or WebP. Max 4MB." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 4MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : "jpg";
    const storagePath = `products/${productId}/main.${safeExt}`;

    const sb = supabaseServer();

    const { data: existing } = await sb
      .from("products")
      .select("image_path")
      .eq("id", productId)
      .single();

    const oldPath = (existing as { image_path?: string | null } | null)?.image_path;
    if (oldPath && oldPath !== storagePath) {
      await sb.storage.from(BUCKET).remove([oldPath]);
    }

    const imageAlt = formData.get("image_alt")?.toString()?.trim() || null;
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

    const updates: { image_path: string; image_alt: string | null } = {
      image_path: storagePath,
      image_alt: imageAlt,
    };

    const { error: updateErr } = await sb
      .from("products")
      .update(updates)
      .eq("id", productId);

    if (updateErr) {
      console.error("Products update error:", updateErr);
      await sb.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: updateErr.message ?? "Failed to update product" },
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

/** DELETE: Remove product image. Query: product_id or JSON body: { product_id } */
export async function DELETE(req: Request) {
  try {
    let productId: string | null = null;
    try {
      const body = await req.json().catch(() => null);
      productId = (body as { product_id?: string } | null)?.product_id?.trim() ?? null;
    } catch {
      /* no body */
    }
    if (!productId) {
      const { searchParams } = new URL(req.url);
      productId = searchParams.get("product_id")?.trim() ?? null;
    }

    if (!productId) {
      return NextResponse.json({ error: "product_id required" }, { status: 400 });
    }

    const sb = supabaseServer();

    const { data: product, error: fetchErr } = await sb
      .from("products")
      .select("image_path")
      .eq("id", productId)
      .single();

    if (fetchErr) throw fetchErr;
    const path = product?.image_path;

    if (path) {
      await sb.storage.from(BUCKET).remove([path]);
    }

    const { error: updateErr } = await sb
      .from("products")
      .update({ image_path: null, image_alt: null })
      .eq("id", productId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
