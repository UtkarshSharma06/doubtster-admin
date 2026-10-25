import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const P = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** scrypt$N$r$p$salt$hash */
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32, P);
  return ["scrypt", P.N, P.r, P.p, salt.toString("base64"), h.toString("base64")].join("$");
}

export async function checkPassword(pw: string, stored: string) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    // Compare against a dummy so timing is the same for unknown users.
    await scrypt(pw, Buffer.alloc(16), 32, P);
    return false;
  }
  const [, N, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(pw, Buffer.from(salt, "base64"), want.length, { N: +N, r: +r, p: +p, maxmem: P.maxmem });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Simple, clear rules. Length matters most. */
export function passwordProblem(pw: string, email = "") {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "That is too long.";
  if (/^(.)\1+$/.test(pw)) return "Do not repeat one character.";
  const low = pw.toLowerCase();
  if (["password", "doubtster", "123456", "qwerty", "admin"].some((w) => low.includes(w))) return "Avoid common words like password or doubtster.";
  if (email && low.includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length > 3) return "Do not use your email name in the password.";
  return "";
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
