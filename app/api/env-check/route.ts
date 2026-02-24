export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env.local");

  let envFileExists = false;
  let envFileFirst200: string | null = null;

  try {
    envFileExists = fs.existsSync(envPath);
    if (envFileExists) {
      const raw = fs.readFileSync(envPath, "utf8");
      envFileFirst200 = raw.slice(0, 200);
    }
  } catch (e: any) {
    envFileFirst200 = `READ_ERROR: ${e?.message ?? String(e)}`;
  }

  return NextResponse.json({
    cwd,
    envPath,
    envFileExists,
    envFileFirst200,
    TEST_VAR: process.env.TEST_VAR ?? null,
    SMTP_USER: process.env.SMTP_USER ?? null,
    SMTP_PASS: process.env.SMTP_PASS ? "exists" : null,
    NODE_ENV: process.env.NODE_ENV ?? null,
  });
}