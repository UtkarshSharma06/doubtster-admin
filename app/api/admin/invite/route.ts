import { NextResponse, type NextRequest } from "next/server";
import { acceptInvite } from "@/lib/admins";
import { loginResponse } from "@/lib/cookies";
import { HttpError } from "@/lib/service";
import { ipOf, rateLimit } from "@/lib/route";

export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (!rateLimit("invite:" + ip, 10, 15 * 60e3)) return NextResponse.json({ error: "Too many tries. Wait 15 minutes." }, { status: 429 });
  let b: { token?: string; password?: string; name?: string } = {};
  try { b = await req.json(); } catch { /* empty */ }
  try {
    return loginResponse(await acceptInvite(String(b.token || ""), String(b.password || ""), String(b.name || ""), ip, req.headers.get("user-agent") || ""));
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
