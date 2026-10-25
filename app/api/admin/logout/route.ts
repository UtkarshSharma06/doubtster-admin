import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readSession } from "@/lib/auth";
import { logout } from "@/lib/admins";
import { clearCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const sid = await readSession(req.cookies.get(COOKIE)?.value).catch(() => null);
  if (sid) await logout(sid);
  return clearCookies(NextResponse.json({ ok: true }));
}
