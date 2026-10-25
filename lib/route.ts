import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { COOKIE, readSession } from "./auth";
import { HttpError } from "./service";
import { contextFor, type Ctx } from "./admins";
import { can, type Level, type Section } from "./perm";

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/** The signed-in admin, their permissions and session. Null when not signed in or no longer allowed. */
export async function currentCtx(): Promise<Ctx | null> {
  const c = await cookies();
  const sid = await readSession(c.get(COOKIE)?.value).catch(() => null);
  return contextFor(sid, await clientIp());
}

type Handler<C> = (req: NextRequest, ctx: Ctx, rc: C) => Promise<unknown>;

/**
 * Wraps an admin API route.
 * need = [section, level] the admin must have, or "super", or "self" (any signed-in admin).
 */
export function adminRoute<C>(need: readonly [Section, Level] | "super" | "self", fn: Handler<C>) {
  return async (req: NextRequest, rc: C) => {
    const ctx = await currentCtx();
    if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    if (ctx.mustSetup2fa && need !== "self") return NextResponse.json({ error: "Turn on two-step sign in first, in My account." }, { status: 403 });
    const ok = need === "self" || (need === "super" ? ctx.admin.role === "super" : can(ctx.perms, need[0], need[1]));
    if (!ok) return NextResponse.json({ error: need === "super" ? "Only a super admin can do that." : "You have " + (Array.isArray(need) ? ctx.perms[need[0]] : "no") + " access here. Ask a super admin." }, { status: 403 });
    try {
      const out = await fn(req, ctx, rc);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 2_000_000) throw new HttpError(413, "Too large");
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Send JSON");
  }
}

export function csvResponse(name: string, rows: unknown[][]) {
  const s = rows
    .map((r) => r.map((v) => {
      let t = v == null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // stop formula injection in Excel
      return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }).join(","))
    .join("\r\n");
  return new Response("﻿" + s, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Tiny in-memory rate limiter. Use Redis/Upstash when you run more than one server. */
const hits = new Map<string, { n: number; t: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); return true; }
  h.n++;
  return h.n <= max;
}
export const ipOf = (req: NextRequest) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
