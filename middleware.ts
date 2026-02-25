import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compareSync } from "bcrypt-edge";

const ADMIN_PATHS = ["/admin"];
const ADMIN_API_PREFIX = "/api/admin";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  const credentials = decodeBasicAuth(authHeader);

  if (!credentials) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
