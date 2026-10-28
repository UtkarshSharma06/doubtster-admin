import { NextResponse, type NextRequest } from "next/server";
import { sendAdminEmailOtp } from "@/lib/admins";
import { ipOf, rateLimit } from "@/lib/route";

export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (!rateLimit("admin_otp_send:" + ip, 6, 15 * 60e3)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes." }, { status: 429 });
  }

  let email = "";
  try {
    const b = await req.json();
    email = String(b.email || "").trim();
  } catch {}

  if (!email) {
    return NextResponse.json({ error: "Enter your admin work email." }, { status: 400 });
  }

  try {
    const res = await sendAdminEmailOtp(email);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send code." }, { status: 400 });
  }
}
