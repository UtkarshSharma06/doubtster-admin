import { NextResponse, type NextRequest } from "next/server";
import { PENDING, verify } from "@/lib/auth";
import { loginSecondStep } from "@/lib/admins";
import { loginResponse } from "@/lib/cookies";
import { ipOf, rateLimit } from "@/lib/route";

export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (!rateLimit("2fa:" + ip, 10, 15 * 60e3)) return NextResponse.json({ error: "Too many tries. Wait 15 minutes." }, { status: 429 });
  const p = await verify<{ aid: string }>(req.cookies.get(PENDING)?.value);
  if (!p) return NextResponse.json({ error: "That took too long. Sign in again.", restart: true }, { status: 401 });
  let code = "";
  try { ({ code } = await req.json()); } catch { /* empty */ }
  return loginResponse(await loginSecondStep(p.aid, String(code || ""), ip, req.headers.get("user-agent") || ""));
}
