import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/* Time-based one-time codes (RFC 6238), the same as Google Authenticator, 1Password and Authy. */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer) {
  let bits = 0, val = 0, out = "";
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string) {
  const clean = s.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32(randomBytes(20));

export function codeAt(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Accepts the code for now, 30 s before and 30 s after (clock drift). */
export function checkCode(secret: string, code: string, now = Date.now()) {
  const c = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c) || !secret) return false;
  const step = Math.floor(now / 30000);
  for (const d of [-1, 0, 1]) {
    const want = Buffer.from(codeAt(secret, step + d));
    if (timingSafeEqual(want, Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, email: string) {
  const label = encodeURIComponent("Doubtster Admin:" + email);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Doubtster Admin")}&algorithm=SHA1&digits=6&period=30`;
}

export function recoveryCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const s = base32(randomBytes(5)).slice(0, 8);
    return s.slice(0, 4) + "-" + s.slice(4);
  });
}
