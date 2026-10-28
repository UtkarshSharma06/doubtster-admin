import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminEmailOtp } from "@/lib/admins";
import { loginResponse } from "@/lib/cookies";
import { ipOf, rateLimit } from "@/lib/route";

export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (!rateLimit("admin_otp_verify:" + ip, 10, 15 * 60e3)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes." }, { status: 429 });
  }

  let email = "", code = "";
  try {
    const b = await req.json();
    email = String(b.email || "").trim();
    code = String(b.code || "").trim();
  } catch {}

  if (!email || !code) {
    return NextResponse.json({ error: "Email and 6-digit verification code are required." }, { status: 400 });
  }

  try {
    const res = await verifyAdminEmailOtp(email, code, ip, req.headers.get("user-agent") || "");
    return loginResponse(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify code." }, { status: 400 });
  }
}
