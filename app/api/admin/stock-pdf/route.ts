export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { addPdfFooter } from "@/lib/pdf-footer";
import PDFDocument from "pdfkit";

const MARGIN = 40;
const FONT_SIZE = 9;
const ROW_HEIGHT = 16;

function money(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

type VariantRow = {
  id: string;
  sku: string;
  size: string | null;
  price: number;
  stock: number;
  product_name: string;
  category: string | null;
};

export async function GET() {
  try {
    const sb = supabaseServer();

    const { data: variants, error } = await sb
      .from("product_variants")
      .select(
        `
        id, sku, size, price, stock,
        products ( id, name, category )
      `
      );

    if (error) throw error;

    type Row = {
      id: string;
      sku: string;
      size: string | null;
      price: number;
      stock: number | null;
      products: { id: string; name: string; category: string | null } | null;
    };

    const rows = (variants ?? []) as unknown as Row[];
    const flat: VariantRow[] = rows.map((r) => ({
      id: r.id,
      sku: r.sku ?? "",
      size: r.size ?? null,
      price: Number(r.price) || 0,
      stock: Number(r.stock) ?? 0,
      product_name: r.products?.name ?? "—",
      category: r.products?.category ?? null,
    }));

    flat.sort((a, b) => {
      const ca = (a.category ?? "").localeCompare(b.category ?? "");
      if (ca !== 0) return ca;
      return (a.product_name ?? "").localeCompare(b.product_name ?? "");
    });

    const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    doc.fontSize(16).text("NCRUFC SHOP — Stock List", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}`,
        { align: "center" }
      );
    doc.moveDown(1);

    const colWidths = [130, 45, 55, 45, 55]; // Product, Size, SKU, Stock, Price
    const headers = ["Product", "Size", "SKU", "Stock", "Price"];

    doc.fontSize(FONT_SIZE).font("Helvetica-Bold");
    let x = MARGIN;
    const tableTop = doc.y;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, tableTop, { width: colWidths[i], continued: false });
      x += colWidths[i];
    }
    doc.moveDown(0.2);
    doc.moveTo(MARGIN, doc.y).lineTo(595 - MARGIN, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font("Helvetica");
    let y = doc.y;

    for (const v of flat) {
      x = MARGIN;
      doc.text((v.product_name ?? "—").trim().slice(0, 28), x, y, {
        width: colWidths[0],
        ellipsis: true,
      });
      x += colWidths[0];
      doc.text((v.size ?? "—").toString().slice(0, 8), x, y, { width: colWidths[1], ellipsis: true });
      x += colWidths[1];
      doc.font("Helvetica").fontSize(FONT_SIZE - 1);
      doc.text((v.sku ?? "—").slice(0, 12), x, y, { width: colWidths[2], ellipsis: true });
      doc.font("Helvetica").fontSize(FONT_SIZE);
      x += colWidths[2];
      doc.text(String(v.stock ?? 0), x, y, { width: colWidths[3] });
      x += colWidths[3];
      doc.text(money(v.price), x, y, { width: colWidths[4] });

      y += ROW_HEIGHT;
      doc.y = y;

      if (y > 750) {
        doc.addPage({ size: "A4", margin: MARGIN });
        doc.fontSize(FONT_SIZE).font("Helvetica");
        y = MARGIN;
        doc.y = y;
      }
    }

    doc.moveDown(0.5);
    doc.moveTo(MARGIN, doc.y).lineTo(595 - MARGIN, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold");
    doc.text(`Total Items: ${flat.length}`, MARGIN, doc.y);

    addPdfFooter(doc, MARGIN);

    const pdf = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });

    const filename = `Stock (${new Date().toISOString().slice(0, 10)}).pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
