import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compareSync } from "bcrypt-edge";

const ADMIN_PATHS = ["/admin"];
const ADMIN_API_PREFIX = "/api/admin";
const ADMIN_SESSION_COOKIE = "admin_session";

function getSessionMode(): "always" | "ttl" | "session" {
  const v = process.env.ADMIN_SESSION_MODE?.toLowerCase();
  if (v === "always" || v === "ttl" || v === "session") return v;
  return "ttl";
}

function getSessionTtlSeconds(): number {
  const v = process.env.ADMIN_SESSION_TTL_SECONDS;
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 600;
} // 24h

function isAdminPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith(ADMIN_API_PREFIX)) return true;
  return false;
}

function decodeBasicAuth(authHeader: string | null): { username: string; password: string } | null {
  if (!authHeader?.startsWith("Basic ")) return null;
  try {
    const base64 = authHeader.slice(6).trim();
    const decoded = atob(base64);
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return {
      username: decoded.slice(0, idx),
      password: decoded.slice(idx + 1),
    };
  } catch {
    return null;
  }
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

async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const idx = cookieValue.indexOf(".");
  if (idx < 0) return false;
  const timestamp = cookieValue.slice(0, idx);
  const sigB64 = cookieValue.slice(idx + 1);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const mode = getSessionMode();
  if (mode === "ttl") {
    const ttlMs = getSessionTtlSeconds() * 1000;
    if (Date.now() - ts > ttlMs) return false;
  }
  // "always" and "session": no TTL check (session cookie expires on browser close)
  try {
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
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return sigB64 === expected;
  } catch {
    return false;
  }
}

async function createSessionCookie(): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return "";
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }
  if (pathname === "/api/admin/login" && request.method === "POST") {
    return NextResponse.next();
  }

  const useSessionCookie = Boolean(process.env.ADMIN_SESSION_SECRET);
  const cookieValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (useSessionCookie && cookieValue) {
    const valid = await verifySessionCookie(cookieValue);
    if (valid) {
      return NextResponse.next();
    }
  }

  const authHeader = request.headers.get("authorization");
  const credentials = decodeBasicAuth(authHeader);

  if (!credentials) {
    if (useSessionCookie && (pathname === "/admin" || pathname.startsWith("/admin/") && pathname !== "/admin/login")) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="NCRUFC Admin"',
      },
    });
  }

  const valid = await validateAdmin(credentials.username, credentials.password);
  if (!valid) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="NCRUFC Admin"',
      },
    });
  }

  const res = NextResponse.next();
  if (useSessionCookie) {
    const token = await createSessionCookie();
    if (token) {
      const mode = getSessionMode();
      const opts: Parameters<typeof res.cookies.set>[2] = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      };
      if (mode === "ttl") opts.maxAge = getSessionTtlSeconds();
      res.cookies.set(ADMIN_SESSION_COOKIE, token, opts);
    }
  }
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
