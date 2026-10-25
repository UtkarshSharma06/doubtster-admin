import type { College, Data } from "./types";
import { fmt } from "./util";

/*
  College domain rules. This file is the single source of truth.
  The admin "Test an email" box, the signup hook and the tests all call it.
*/

export const PUBLIC_MAIL = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "aol.com", "gmx.de", "gmx.net", "gmx.com",
  "web.de", "yandex.com", "yandex.ru", "mail.com", "zoho.com", "qq.com", "163.com", "126.com", "rediffmail.com",
  "hey.com", "fastmail.com", "tutanota.com", "duck.com",
];

// A short starter list. Swap for a maintained package such as "disposable-email-domains" in production.
export const DISPOSABLE = [
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com", "temp-mail.org", "yopmail.com",
  "trashmail.com", "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc", "throwawaymail.com",
];

export function normDomain(d: string) {
  return String(d || "").toLowerCase().trim().replace(/^@+/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

export function emailDomain(e: string) {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(String(e || "").trim().toLowerCase());
  return m ? m[1] : "";
}

const endsWithDomain = (d: string, root: string) => d === root || d.endsWith("." + root);

export function isDisposable(domain: string) {
  return DISPOSABLE.some((x) => endsWithDomain(domain, x));
}

/** Longest matching college domain wins, active or not. */
export function matchCollege(colleges: College[], email: string): College | null {
  const d = emailDomain(email);
  if (!d) return null;
  let best: College | null = null;
  for (const c of colleges) {
    const ok = d === c.domain || (c.subdomains && d.endsWith("." + c.domain));
    if (ok && (!best || c.domain.length > best.domain.length)) best = c;
  }
  return best;
}

export function grantedCount(d: Data, collegeId: string) {
  return d.creditGrants.filter((g) => g.source === "college_signup" && g.collegeId === collegeId && g.status !== "revoked").length;
}

export interface SignupResult {
  ok: boolean;
  college: Pick<College, "id" | "name" | "domain" | "active"> | null;
  credits: number; // total credits the user gets now
  collegeCredits: number; // part of that from the college
  held: number; // college credits waiting for email verification
  expiryDays: number;
  reason: string;
}

export function evaluateSignup(d: Data, email: string, verified: boolean, code?: string, today = new Date()): SignupResult {
  const dom = emailDomain(email);
  const base = Number(d.flags.freeCredits) || 0;
  const r: SignupResult = { ok: true, college: null, credits: base, collegeCredits: 0, held: 0, expiryDays: 0, reason: "" };
  if (!dom) return { ...r, ok: false, credits: 0, reason: "Not a valid email address." };
  if (!d.flags.signups) return { ...r, ok: false, credits: 0, reason: "Signups are turned off in App controls." };
  if (isDisposable(dom)) return { ...r, ok: false, credits: 0, reason: dom + " is a throwaway email service." };

  const c = matchCollege(d.colleges, email);
  if (!c) {
    r.reason = PUBLIC_MAIL.includes(dom) ? "Personal email. Normal signup." : "No college matches " + dom + ". Normal signup.";
    return r;
  }
  r.college = { id: c.id, name: c.name, domain: c.domain, active: c.active };
  const day = today.toISOString().slice(0, 10);
  if (!c.active) return { ...r, reason: c.name + " is paused, so no college credits." };
  if (d.flags.emergency?.stopSignupCredits) return { ...r, reason: "Signup credits are paused in Emergency controls." };
  if (c.starts && day < c.starts) return { ...r, reason: "Campaign for " + c.name + " starts on " + fmt(c.starts) + "." };
  if (c.ends && day > c.ends) return { ...r, reason: "Campaign for " + c.name + " ended on " + fmt(c.ends) + "." };
  if (c.cap && grantedCount(d, c.id) >= c.cap) return { ...r, reason: c.name + " hit its cap of " + c.cap + " students." };
  if (c.codeMode === "code" && String(code || "").trim().toUpperCase() !== String(c.code || "").toUpperCase())
    return { ...r, reason: "This college needs the code " + (c.code || "(none set)") + " at signup." };
  r.expiryDays = c.expiryDays;
  if (c.requireVerify && !verified) return { ...r, held: c.credits, reason: c.credits + " credits are held until the email is verified." };
  r.collegeCredits = c.credits;
  r.credits = base + c.credits;
  r.reason = "Matched " + c.name + " (" + c.domain + (c.subdomains ? " and subdomains" : "") + "). +" + c.credits + " college credits" + (c.expiryDays ? ", expire after " + c.expiryDays + " days" : "") + ".";
  return r;
}

export interface CollegeInput {
  name: string; domain: string; country: string; subdomains: boolean; credits: number; expiryDays: number; cap: number;
  code: string; codeMode: "domain" | "code"; starts: string; ends: string; requireVerify: boolean; active: boolean; note: string;
}

/** Validates and normalises admin input. Returns an error message or the clean value. */
export function validateCollege(d: Data, raw: Partial<CollegeInput>, selfId?: string): { error: string } | { value: CollegeInput } {
  const s = (v: unknown) => String(v ?? "").trim();
  const n = (v: unknown) => Math.floor(Number(v));
  const v: CollegeInput = {
    name: s(raw.name).slice(0, 120),
    domain: normDomain(s(raw.domain)),
    country: s(raw.country).slice(0, 60) || "Unknown",
    subdomains: raw.subdomains !== false,
    credits: n(raw.credits),
    expiryDays: n(raw.expiryDays) || 0,
    cap: n(raw.cap) || 0,
    code: s(raw.code).toUpperCase().replace(/\s+/g, "").slice(0, 24),
    codeMode: raw.codeMode === "code" ? "code" : "domain",
    starts: /^\d{4}-\d{2}-\d{2}$/.test(s(raw.starts)) ? s(raw.starts) : "",
    ends: /^\d{4}-\d{2}-\d{2}$/.test(s(raw.ends)) ? s(raw.ends) : "",
    requireVerify: raw.requireVerify !== false,
    active: raw.active !== false,
    note: s(raw.note).slice(0, 500),
  };
  if (!v.name) return { error: "Add the college name." };
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v.domain)) return { error: "Domain should look like upes.ac.in" };
  if (PUBLIC_MAIL.includes(v.domain)) return { error: v.domain + " is a public email provider. Anyone could sign up with it." };
  if (isDisposable(v.domain)) return { error: v.domain + " is a throwaway email service." };
  if (d.colleges.some((x) => x.id !== selfId && x.domain === v.domain)) return { error: v.domain + " is already added." };
  if (!(v.credits >= 0 && v.credits <= 500)) return { error: "Credits must be 0 to 500." };
  if (!(v.expiryDays >= 0 && v.expiryDays <= 3650)) return { error: "Expiry must be 0 to 3650 days." };
  if (!(v.cap >= 0 && v.cap <= 1000000)) return { error: "Max students must be 0 or more." };
  if (v.codeMode === "code" && !v.code) return { error: "Set a promo code, or let anyone with the email get credits." };
  if (v.code && !/^[A-Z0-9_-]{3,24}$/.test(v.code)) return { error: "Promo code: 3 to 24 letters, numbers, - or _." };
  if (v.code && d.colleges.some((x) => x.id !== selfId && x.code === v.code)) return { error: "Another college already uses " + v.code + "." };
  if (v.starts && v.ends && v.ends < v.starts) return { error: "End date is before the start date." };
  return { value: v };
}
