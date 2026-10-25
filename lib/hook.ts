import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { HttpError } from "./service";

/** Server-to-server hooks. Your signup backend sends: Authorization: Bearer <HOOK_SECRET> */
export function hookRoute(fn: (b: Record<string, unknown>) => Promise<unknown>) {
  return async (req: NextRequest) => {
    const s = process.env.HOOK_SECRET || "";
    const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const h = (x: string) => createHash("sha256").update(x).digest();
    if (s.length < 32 || !timingSafeEqual(h(got), h(s))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      return NextResponse.json(await fn(await req.json()));
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof SyntaxError) return NextResponse.json({ error: "Send JSON" }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}
