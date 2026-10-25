import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readSession } from "@/lib/auth";

/*
  Guards every admin page and admin API.
  - No valid session: pages go to /admin/login, APIs get 401.
  - Writes must come from this site (Origin check) to block CSRF.
*/
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/admin");
  const open = pathname === "/admin/login" || pathname.startsWith("/admin/invite/") || pathname === "/api/admin/login" || pathname === "/api/admin/login/2fa" || pathname === "/api/admin/invite";

  if (isApi && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (!origin || new URL(origin).host !== host) {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
  }
  if (open) return NextResponse.next();

  const who = await readSession(req.cookies.get(COOKIE)?.value).catch(() => null);
  if (!who) {
    if (isApi) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    const u = req.nextUrl.clone();
    u.pathname = "/admin/login";
    u.search = pathname === "/admin" ? "" : "?next=" + encodeURIComponent(pathname);
    return NextResponse.redirect(u);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
