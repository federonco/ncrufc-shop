export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendOrderEmail } from "@/lib/email";

export async function GET() {
  try {
    await sendOrderEmail({
      subject: "NCRUFC Shop - email test",
      html: "<p>If you received this, SMTP is working ✅</p>",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}