import "server-only";
import { NextResponse } from "next/server";
import { COOKIE, PENDING, sign } from "./auth";
import type { LoginResult } from "./admins";

const secure = process.env.NODE_ENV === "production";

/** Turns a login result into a response with the right cookie. */
export async function loginResponse(r: LoginResult, next = "/admin") {
  if (r.kind === "fail") return NextResponse.json({ error: r.message }, { status: 401 });
  if (r.kind === "2fa") {
    const res = NextResponse.json({ step: "2fa" });
    res.cookies.set(PENDING, await sign({ aid: r.adminId, exp: Date.now() + 5 * 60e3 }), { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 300 });
    return res;
  }
  const res = NextResponse.json({ ok: true, next });
  res.cookies.set(COOKIE, await sign({ sid: r.sid, exp: r.exp }), { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: Math.floor((r.exp - Date.now()) / 1000) });
  res.cookies.set(PENDING, "", { path: "/", maxAge: 0 });
  return res;
}

export function clearCookies(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  res.cookies.set(PENDING, "", { path: "/", maxAge: 0 });
  return res;
}
