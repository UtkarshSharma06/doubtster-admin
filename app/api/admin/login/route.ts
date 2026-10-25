import { NextResponse, type NextRequest } from "next/server";
import { login } from "@/lib/admins";
import { loginResponse } from "@/lib/cookies";
import { ipOf, rateLimit } from "@/lib/route";

export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (!rateLimit("login:" + ip, 10, 15 * 60e3)) return NextResponse.json({ error: "Too many tries from this network. Wait 15 minutes." }, { status: 429 });
  let email = "", password = "";
  try { ({ email, password } = await req.json()); } catch { /* empty */ }
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  try {
    return loginResponse(await login(String(email), String(password), ip, req.headers.get("user-agent") || ""));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sign in is not set up. Check ADMIN_SECRET in the server env." }, { status: 500 });
  }
}
