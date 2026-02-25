export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";

const MARGIN = 40;
const FONT_SIZE = 10;
const ROW_HEIGHT = 18;

type OrderRow = {
  id: string;
  reference: string;
  customer_name: string;
  customer_email: string | null;
  total: number;
  paid_at: string | null;
  status: string | null;
  created_at: string;
};

function money(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function formatDateLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") ?? "", 10);
    const month = parseInt(searchParams.get("month") ?? "", 10);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "Invalid year or month. Use year=YYYY and month=1-12" },
        { status: 400 }
      );
    }

    const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00Z`;

    const sb = supabaseServer();
    const { data: orders, error } = await sb
      .from("orders")
      .select("id, reference, customer_name, customer_email, total, paid_at, status, created_at")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (orders ?? []) as OrderRow[];
    const totalAmount = rows.reduce((sum, o) => sum + (Number(o.total) ?? 0), 0);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthLabel = `${monthNames[month - 1]} ${year}`;

    const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    doc.fontSize(16).text("NCRUFC SHOP — Monthly Orders Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Month: ${monthLabel}`, { align: "center" });
    doc.moveDown(1.5);

    const tableTop = doc.y;
    const colWidths = [95, 65, 90, 110, 55, 45, 50];
    const headers = ["Date", "Reference", "Customer", "Email", "Total", "Paid?", "Status"];

    doc.fontSize(FONT_SIZE).font("Helvetica-Bold");
    let x = MARGIN;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, tableTop, { width: colWidths[i], continued: false });
      x += colWidths[i];
    }
    doc.moveDown(0.3);
    doc.moveTo(MARGIN, doc.y).lineTo(595 - MARGIN, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica");
    let y = doc.y;

    for (const o of rows) {
      const dateStr = formatDateLocal(o.created_at);
      const paid = o.paid_at ? "Yes" : "No";
      const status = o.status ?? "—";

      x = MARGIN;
      doc.text(dateStr, x, y, { width: colWidths[0], ellipsis: true });
      x += colWidths[0];
      doc.text(o.reference ?? "—", x, y, { width: colWidths[1], ellipsis: true });
      x += colWidths[1];
      doc.text((o.customer_name ?? "").trim() || "—", x, y, { width: colWidths[2], ellipsis: true });
      x += colWidths[2];
      doc.text((o.customer_email ?? "").trim() || "—", x, y, { width: colWidths[3], ellipsis: true });
      x += colWidths[3];
      doc.text(money(Number(o.total) ?? 0), x, y, { width: colWidths[4] });
      x += colWidths[4];
      doc.text(paid, x, y, { width: colWidths[5] });
      x += colWidths[5];
      doc.text(status, x, y, { width: colWidths[6], ellipsis: true });

      y += ROW_HEIGHT;
      doc.y = y;

      if (y > 750) {
        doc.addPage({ size: "A4", margin: MARGIN });
        doc.fontSize(FONT_SIZE).font("Helvetica");
        y = MARGIN;
        doc.y = y;
      }
    }

    doc.moveDown(1);
    doc.moveTo(MARGIN, doc.y).lineTo(595 - MARGIN, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold");
    doc.text(`Total: ${money(totalAmount)}`, MARGIN, doc.y);
    doc.text(`Orders: ${rows.length}`, MARGIN, doc.y + ROW_HEIGHT);

    const pdf = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });

    const filename = `Orders (${monthLabel}).pdf`;
    return new NextResponse(new Uint8Array(pdf), {
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
