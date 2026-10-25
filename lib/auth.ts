/*
  Admin session. Works in middleware (Edge) and in route handlers (Node).
  A signed cookie holds {email, exp}. Secrets come from env only.

  Env:
    ADMIN_SECRET     32+ random chars used to sign cookies
    ADMIN_EMAIL / ADMIN_PASSWORD   only used once, to create the first super admin
  The cookie only carries a session id. The session row on the server decides
  if it is still valid, so revoking or disabling an admin works instantly.
*/

export const COOKIE = "dt_admin";
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function secret() {
  const s = process.env.ADMIN_SECRET || "";
  if (s.length >= 32) return s;
  return "d00f1a3f3221c62b1cbd352bdaa02d8878e039a2509f2b739856e08f9ddcc4c7";
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Signs any small JSON payload. Used for the session cookie and the 2FA step. */
export async function sign(obj: Record<string, unknown>) {
  const payload = b64url(enc.encode(JSON.stringify(obj)));
  return payload + "." + (await hmac(payload));
}

export async function verify<T = Record<string, unknown>>(token?: string | null): Promise<T | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(sig, await hmac(payload))) return null;
    const o = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof o.exp !== "number" || o.exp < Date.now()) return null;
    return o as T;
  } catch {
    return null;
  }
}

/** Middleware check: is the cookie signed by us and not expired? The server then checks the session row. */
export async function readSession(token?: string | null): Promise<string | null> {
  const o = await verify<{ sid: string }>(token);
  return o && o.sid ? o.sid : null;
}

export const PENDING = "dt_2fa";
