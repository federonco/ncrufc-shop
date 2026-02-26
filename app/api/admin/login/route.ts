export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compareSync } from "bcrypt-edge";

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_SEC = 24 * 60 * 60;

async function createSessionCookie(secret: string): Promise<string> {
  const timestamp = String(Date.now());
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${timestamp}.${sigB64}`;
}

async function validateAdmin(username: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("admin_users")
    .select("password_hash, active")
    .eq("username", username)
    .maybeSingle();

  if (error || !data || !data.active) return false;

  try {
    return compareSync(password, data.password_hash);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Admin session not configured. Set ADMIN_SESSION_SECRET." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const valid = await validateAdmin(username, password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await createSessionCookie(secret);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
