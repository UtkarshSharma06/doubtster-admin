import "server-only";
import { createHash } from "crypto";
import { tx } from "./store";
import type { AuditEntry, Data, Flags, Plan, Post, Site, User } from "./types";
import { PLANS } from "./types";
import { evaluateSignup, emailDomain, matchCollege, validateCollege, type CollegeInput } from "./college";
import { nowISO, uid } from "./util";
import { seed } from "./seed";
import { BOTS } from "./bots";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new HttpError(400, m);
const notFound = (m = "Not found") => new HttpError(404, m);

export function audit(d: Data, by: string, type: AuditEntry["type"], action: string, target: string, detail: string, ip?: string) {
  d.audit.unshift({ id: uid("a"), t: nowISO(), by, type, action, target, detail, ...(ip ? { ip } : {}) });
  if (d.audit.length > 5000) d.audit.length = 5000;
}

const hashEmail = (e: string) => createHash("sha256").update(e.trim().toLowerCase()).digest("hex");

/* ---------------- signup hook ---------------- */

export interface SignupInput {
  email: string; name?: string; verified?: boolean; code?: string;
  country?: string; source?: string; device?: string; lang?: string; dryRun?: boolean;
}

/**
 * Call this from your signup handler, after the account row is created.
 * One college grant per email, ever. Safe to call twice.
 */
export function registerSignup(input: SignupInput, by = "system") {
  return tx((d) => {
    const email = String(input.email || "").trim().toLowerCase();
    const res = evaluateSignup(d, email, !!input.verified, input.code);
    if (input.dryRun || !res.ok) return { ...res, user: null as User | null };
    if (d.users.some((u) => u.email === email)) throw new HttpError(409, "That email already has an account.");

    const eh = hashEmail(email);
    const already = d.creditGrants.some((g) => g.emailHash === eh && g.source === "college_signup");
    const c = res.college ? d.colleges.find((x) => x.id === res.college!.id) || null : null;
    const giveNow = already ? 0 : res.collegeCredits;
    const hold = already ? 0 : res.held;

    const local = email.split("@")[0].replace(/[^a-z]+/g, " ").trim() || "student";
    const u: User = {
      id: uid("u"), name: (input.name || local.replace(/\b\w/g, (x) => x.toUpperCase())).slice(0, 80), email,
      plan: "Free", credits: (Number(d.flags.freeCredits) || 0) + giveNow, joined: nowISO().slice(0, 10), status: "active",
      lang: input.lang || "en", collegeId: c ? c.id : "", country: input.country || (c ? c.country : "Unknown"),
      source: input.source || (input.code ? "college code" : "direct"), device: input.device || "desktop", subject: "math",
      videos: 0, chats: 0, signupCredits: giveNow, pendingCredits: hold, creditsUsed: 0, verified: !!input.verified, lastActive: nowISO(),
    };
    d.users.unshift(u);
    if (c && (giveNow || hold)) {
      d.creditGrants.push({
        id: uid("cg"), userId: u.id, emailHash: eh, source: "college_signup", collegeId: c.id, credits: giveNow || hold,
        status: giveNow ? "granted" : "held",
        expiresAt: c.expiryDays ? new Date(Date.now() + c.expiryDays * 864e5).toISOString() : "", createdAt: nowISO(),
      });
    }
    audit(d, by, "signup", by === "system" ? "Signup" : "Simulated signup", email,
      (c ? c.name + ", " : "") + (giveNow ? "+" + giveNow + " college credits" : already ? "college credits already used by this email" : "no college credits") + (hold ? ", " + hold + " held" : ""));
    return { ...res, credits: u.credits, collegeCredits: giveNow, held: hold, user: u };
  });
}

/** Call from your email verification handler. Releases held college credits. */
export function markEmailVerified(email: string) {
  return tx((d) => {
    const u = d.users.find((x) => x.email === String(email).trim().toLowerCase());
    if (!u) throw notFound("No user with that email.");
    u.verified = true;
    const g = d.creditGrants.find((x) => x.userId === u.id && x.source === "college_signup" && x.status === "held");
    let released = 0;
    if (g) {
      const c = d.colleges.find((x) => x.id === g.collegeId);
      // Re-check the college at release time: it may have been paused since signup.
      if (c && c.active) {
        g.status = "granted";
        released = g.credits;
        u.credits += released;
        u.signupCredits = released;
        u.pendingCredits = 0;
        if (c.expiryDays) g.expiresAt = new Date(Date.now() + c.expiryDays * 864e5).toISOString();
      } else {
        g.status = "revoked";
        u.pendingCredits = 0;
      }
      audit(d, "system", "signup", "Email verified", u.email, released ? "+" + released + " college credits released" : "college paused, held credits dropped");
    }
    return { released };
  });
}

/** Run daily (cron). Removes unused college credits after their expiry. */
export function expireCredits() {
  return tx((d) => {
    const now = new Date().toISOString();
    let n = 0;
    for (const g of d.creditGrants) {
      if (g.status !== "granted" || !g.expiresAt || g.expiresAt > now) continue;
      const u = d.users.find((x) => x.id === g.userId);
      if (u) {
        const unused = Math.max(0, g.credits - (u.creditsUsed || 0));
        u.credits = Math.max(0, u.credits - unused);
      }
      g.status = "expired";
      n++;
    }
    if (n) audit(d, "system", "credits", "Expired college credits", "cron", n + " grants");
    return { expired: n };
  });
}

/* ---------------- colleges ---------------- */

export function createCollege(raw: Partial<CollegeInput>, by: string) {
  return tx((d) => {
    const r = validateCollege(d, raw);
    if ("error" in r) throw bad(r.error);
    const c = { id: uid("c"), created: nowISO(), ...r.value };
    d.colleges.push(c);
    audit(d, by, "college", "Added college", c.domain, c.name + ", " + c.credits + " credits" + (c.active ? "" : ", paused"));
    return c;
  });
}

export function updateCollege(id: string, raw: Partial<CollegeInput>, by: string) {
  return tx((d) => {
    const c = d.colleges.find((x) => x.id === id);
    if (!c) throw notFound();
    const merged = { ...c, ...raw };
    const r = validateCollege(d, merged, id);
    if ("error" in r) throw bad(r.error);
    const changes: string[] = [];
    const cr = c as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(r.value)) {
      if (String(cr[k]) !== String(v)) changes.push(k + ": " + (cr[k] === "" ? "-" : cr[k]) + " → " + (v === "" ? "-" : v));
    }
    if (!changes.length) return c;
    const wasActive = c.active;
    Object.assign(c, r.value);
    const action = changes.length === 1 && wasActive !== c.active ? (c.active ? "Reactivated domain" : "Paused domain")
      : changes.length === 1 && changes[0].startsWith("credits:") ? "Changed signup credits" : "Edited college";
    audit(d, by, "college", action, c.domain, changes.join("; "));
    return c;
  });
}

export function deleteCollege(id: string, by: string) {
  return tx((d) => {
    const c = d.colleges.find((x) => x.id === id);
    if (!c) throw notFound();
    d.colleges = d.colleges.filter((x) => x.id !== id);
    audit(d, by, "college", "Deleted college", c.domain, c.name + ". Users keep their credits.");
    return { ok: true };
  });
}

export function bulkCollegeCredits(id: string, credits: number, by: string) {
  return tx((d) => {
    const c = d.colleges.find((x) => x.id === id);
    if (!c) throw notFound();
    const n = Math.floor(Number(credits));
    if (!(n >= 1 && n <= 100)) throw bad("Add 1 to 100 credits.");
    const U = d.users.filter((u) => u.collegeId === id && u.status === "active");
    if (!U.length) throw bad("No active students at this college yet.");
    U.forEach((u) => {
      u.credits += n;
      d.creditGrants.push({ id: uid("cg"), userId: u.id, emailHash: "", source: "bulk_college", collegeId: id, credits: n, status: "granted", expiresAt: "", createdAt: nowISO() });
    });
    audit(d, by, "credits", "Bulk credits to college", c.domain, "+" + n + " to " + U.length + " users");
    return { users: U.length };
  });
}

/* ---------------- users ---------------- */

export function updateUser(id: string, body: { plan?: Plan; credits?: number; status?: string }, by: string) {
  return tx((d) => {
    const u = d.users.find((x) => x.id === id);
    if (!u) throw notFound();
    const ch: string[] = [];
    if (body.plan !== undefined) {
      if (!PLANS.includes(body.plan)) throw bad("Unknown plan.");
      if (body.plan !== u.plan) { ch.push("plan " + u.plan + " → " + body.plan); u.plan = body.plan; }
    }
    if (body.credits !== undefined) {
      const c = Math.floor(Number(body.credits));
      if (!(c >= 0 && c <= 100000)) throw bad("Credits must be 0 or more.");
      if (c !== u.credits) { ch.push("credits " + u.credits + " → " + c); u.credits = c; }
    }
    if (body.status !== undefined) {
      const s = body.status === "suspended" ? "suspended" : "active";
      if (s !== u.status) { ch.push(s === "active" ? "reactivated" : "suspended"); u.status = s; }
    }
    if (ch.length) audit(d, by, "user", "Edited user", u.email, ch.join("; "));
    return u;
  });
}

/* ---------------- payments ---------------- */

function newExpiry(u: User, plan: Plan, days: number) {
  const now = new Date();
  let base = now;
  if (u.plan === plan && u.expires && new Date(u.expires) > now) base = new Date(u.expires);
  return new Date(base.getTime() + days * 864e5).toISOString().slice(0, 10);
}

export function manualGrant(b: { userId: string; plan: Plan; days: number; credits: number; reason: string; note?: string; ref?: string; paymentId?: string }, by: string) {
  return tx((d) => {
    const pay = b.paymentId ? d.payments.find((x) => x.id === b.paymentId) : undefined;
    const u = d.users.find((x) => x.id === (pay ? pay.userId : b.userId));
    if (!u) throw notFound("User not found.");
    const days = Math.floor(Number(b.days) || 0), cr = Math.floor(Number(b.credits) || 0);
    if (!PLANS.includes(b.plan) || b.plan === "Free") throw bad("Pick a paid plan.");
    if (days < 0 || days > 730 || cr < 0 || cr > 500) throw bad("Days 0 to 730, credits 0 to 500.");
    if (!days && !cr) throw bad("Add days of access or credits.");
    if (!b.reason) throw bad("Pick a reason.");
    if (b.reason === "Other" && !String(b.note || "").trim()) throw bad("Add a note when the reason is Other.");
    const g = {
      id: uid("g"), date: nowISO(), userId: u.id, plan: b.plan, prevPlan: u.plan, prevExpires: u.expires || "", days, credits: cr,
      reason: b.reason, note: String(b.note || "").trim().slice(0, 500), ref: String(b.ref || "").trim().slice(0, 80),
      paymentId: pay ? pay.id : "", by, status: "active" as const, expires: undefined as string | undefined,
    };
    if (days) { const ne = newExpiry(u, b.plan, days); u.plan = b.plan; u.expires = ne; u.manual = true; g.expires = ne; }
    u.credits += cr;
    if (pay) { pay.status = "resolved"; pay.grantId = g.id; }
    d.grants.unshift(g);
    audit(d, by, "payment", "Manual grant", u.email, (days ? b.plan + " for " + days + " days" : "") + (cr ? (days ? ", " : "") + "+" + cr + " credits" : "") + ". " + b.reason);
    return g;
  });
}

export function revokeGrant(id: string, by: string) {
  return tx((d) => {
    const g = d.grants.find((x) => x.id === id);
    if (!g || g.status !== "active") throw notFound("Grant not found or already revoked.");
    const u = d.users.find((x) => x.id === g.userId);
    if (u) {
      if (g.days) { u.plan = g.prevPlan; u.expires = g.prevExpires; if (g.prevPlan === "Free") u.manual = false; }
      u.credits = Math.max(0, u.credits - g.credits);
    }
    g.status = "revoked";
    const p = d.payments.find((x) => x.grantId === id);
    if (p) { p.status = "failed"; delete p.grantId; }
    audit(d, by, "payment", "Revoked grant", u ? u.email : g.userId, g.plan + (g.credits ? ", -" + g.credits + " credits" : ""));
    return { ok: true };
  });
}

export function rejectPayment(id: string, by: string) {
  return tx((d) => {
    const p = d.payments.find((x) => x.id === id);
    if (!p || p.status !== "failed") throw notFound("Payment not found or already handled.");
    p.status = "rejected";
    p.note = p.note || "Rejected by admin";
    audit(d, by, "payment", "Rejected payment", p.ref, p.amount + " " + p.cur);
    return p;
  });
}

/* ---------------- videos ---------------- */

export function jobAction(id: string, action: "retry" | "cancel", by: string) {
  return tx((d) => {
    const j = d.jobs.find((x) => x.id === id);
    if (!j) throw notFound();
    if (action === "retry") { if (j.status !== "failed") throw bad("Only failed jobs can be retried."); j.status = "queued"; j.verify = "pending"; }
    else { if (j.status !== "queued" && j.status !== "rendering") throw bad("Only queued or rendering jobs can be cancelled."); j.status = "failed"; j.verify = "failed"; }
    audit(d, by, "system", action === "retry" ? "Retried video job" : "Cancelled video job", j.id, j.q);
    return j;
  });
}

/* ---------------- config, content, settings ---------------- */

/* Limits for every number in App controls, by path. Anything not listed must be 0 or more. */
const NUM_LIMITS: Record<string, [number, number]> = {
  trialDays: [0, 60], creditsPerVideo: [0, 50], freeCredits: [0, 100], maxVideoMin: [1, 60], rateLimit: [1, 10000],
  priceTrial: [0, 1000], trialVideos: [0, 100], priceMonthly: [0, 1000], monthlyCredits: [0, 10000], priceAnnual: [0, 10000],
  topup10: [0, 1000], topup25: [0, 1000], costPerVideoMin: [0, 100],
  "ai.temperature": [0, 1], "ai.maxTokens": [256, 32000], "ai.monthlyBudget": [0, 100000], "ai.alertAt": [10, 100],
  "chatx.maxQuestionChars": [100, 20000], "chatx.historyDays": [1, 3650],
  "attachments.maxMB": [1, 50], "attachments.maxFiles": [1, 10],
  "videox.defaultSec": [30, 900], "videox.maxPerDayFree": [0, 50], "videox.maxPerDayPaid": [0, 200], "videox.concurrent": [1, 20],
  "creditsx.referrerCredits": [0, 100], "creditsx.refereeCredits": [0, 100], "creditsx.lowCreditAlert": [0, 100],
  "safety.minAge": [13, 21], "notify.trialEndingDays": [1, 14],
  "rollout.voiceInput": [0, 100], "rollout.aiTutorMode": [0, 100], "rollout.newEditor": [0, 100], "rollout.examMode": [0, 100],
};
const ENUMS: Record<string, string[]> = {
  bannerType: ["info", "warning", "success"], bannerAudience: ["all", "free", "paid"],
  provider: ["gemini", "groq", "sambanova", "openrouter", "paid"], provider2: ["gemini", "groq", "sambanova", "openrouter", "paid"],
  "ai.chatProvider": ["gemini", "groq", "sambanova", "openrouter", "paid"], "ai.videoProvider": ["gemini", "groq", "sambanova", "openrouter", "paid"], "ai.notesProvider": ["gemini", "groq", "sambanova", "openrouter", "paid"],
  "ai.overBudget": ["alert", "pause_video", "pause_free"], "videox.resolution": ["720p", "1080p"], "safety.moderation": ["relaxed", "standard", "strict"],
};

/** Cleans one value against the saved one: same type, inside limits. Unknown keys are dropped. */
function clean(path: string, old: unknown, v: unknown): unknown {
  if (typeof old === "boolean") return !!v;
  if (typeof old === "number") {
    const n = Number(v);
    const lim = NUM_LIMITS[path] || [0, 1e9];
    if (!Number.isFinite(n) || n < lim[0] || n > lim[1]) throw bad(label(path) + " must be between " + lim[0] + " and " + lim[1] + ".");
    return Math.round(n * 1000) / 1000;
  }
  if (typeof old === "string") {
    const sv = String(v ?? "").slice(0, 300);
    if (ENUMS[path] && !ENUMS[path].includes(sv)) throw bad(label(path) + " has an unknown value.");
    if ((path === "bannerStarts" || path === "bannerEnds") && sv && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(sv)) throw bad("Banner dates must be dates.");
    if (path === "bannerLink" && sv && !/^(https:\/\/|\/)/.test(sv)) throw bad("Banner link must start with https:// or /.");
    return sv;
  }
  if (Array.isArray(old)) return (Array.isArray(v) ? v : []).map((x) => String(x).trim().toLowerCase().slice(0, 60)).filter(Boolean).slice(0, 500);
  if (old && typeof old === "object") {
    const o: Record<string, unknown> = {};
    const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    for (const [k, ov] of Object.entries(old as Record<string, unknown>)) o[k] = k in src ? clean(path + "." + k, ov, src[k]) : ov;
    return o;
  }
  return old;
}
const label = (path: string) => path.split(".").pop()!.replace(/([A-Z])/g, " $1").toLowerCase();

export function saveFlags(next: Partial<Flags>, by: string, note = "") {
  return tx((d) => {
    const cur = d.flags as unknown as Record<string, unknown>;
    const before = structuredClone(d.flags);
    const ch: string[] = [];
    for (const [k, v] of Object.entries(next)) {
      if (!(k in cur)) continue;
      const val = clean(k, cur[k], v);
      if (JSON.stringify(cur[k]) !== JSON.stringify(val)) { ch.push(...diffKeys(k, cur[k], val)); cur[k] = val; }
    }
    if (ch.length) {
      d.configHistory.unshift({ id: uid("cfg"), at: nowISO(), by, changed: ch, flags: before });
      if (d.configHistory.length > 50) d.configHistory.length = 50;
      const em = ch.filter((c) => c.startsWith("emergency.") || c === "maintenance");
      audit(d, by, "controls", em.length ? "Changed emergency switches" : "Saved app controls", "flags", (note ? note + ": " : "") + ch.slice(0, 12).join(", ") + (ch.length > 12 ? " and " + (ch.length - 12) + " more" : ""));
    }
    return { flags: d.flags, changed: ch };
  });
}
function diffKeys(path: string, a: unknown, b: unknown): string[] {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    return Object.keys(b as object).flatMap((k) => (JSON.stringify((a as Record<string, unknown>)[k]) !== JSON.stringify((b as Record<string, unknown>)[k]) ? diffKeys(path + "." + k, (a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]) : []));
  }
  return [path];
}

/** Puts App controls back to how they were before a saved change. That restore is itself saved, so it can be undone. */
export function restoreFlags(snapshotId: string, by: string) {
  return tx((d) => {
    const snap = d.configHistory.find((x) => x.id === snapshotId);
    if (!snap) throw notFound("That version is gone.");
    const before = structuredClone(d.flags);
    const changed = diffKeys("", before, snap.flags).map((x) => x.replace(/^\./, ""));
    d.flags = structuredClone(snap.flags);
    d.configHistory.unshift({ id: uid("cfg"), at: nowISO(), by, changed: ["restored version from " + snap.at.slice(0, 16).replace("T", " ")], flags: before });
    audit(d, by, "controls", "Restored app controls", "flags", "to before the change at " + snap.at.slice(0, 16).replace("T", " ") + " (" + changed.length + " settings)");
    return d.flags;
  });
}

/* ---------------- promo codes ---------------- */
export interface PromoInput { code: string; kind: "credits" | "percent" | "trial_days"; value: number; plans: string[]; maxUses: number; perUser: number; starts: string; ends: string; active: boolean; newUsersOnly: boolean; note: string }

function validatePromo(d: Data, raw: Partial<PromoInput>, selfId?: string): PromoInput {
  const code = String(raw.code || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw bad("Code: 3 to 24 letters, numbers, - or _.");
  if (d.promos.some((p) => p.id !== selfId && p.code === code)) throw bad(code + " already exists.");
  if (d.colleges.some((c) => c.code === code)) throw bad(code + " is already a college code.");
  const kind = raw.kind === "percent" || raw.kind === "trial_days" ? raw.kind : "credits";
  const value = Math.floor(Number(raw.value));
  const lim = kind === "percent" ? [1, 90] : kind === "trial_days" ? [1, 60] : [1, 500];
  if (!(value >= lim[0] && value <= lim[1])) throw bad((kind === "percent" ? "Discount" : kind === "trial_days" ? "Trial days" : "Credits") + " must be " + lim[0] + " to " + lim[1] + ".");
  const date = (x: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || "")) ? String(x) : "");
  const v: PromoInput = {
    code, kind, value, plans: (Array.isArray(raw.plans) ? raw.plans : []).filter((x) => x === "Pro monthly" || x === "Pro annual" || x === "Pro trial"),
    maxUses: Math.max(0, Math.floor(Number(raw.maxUses) || 0)), perUser: Math.min(10, Math.max(1, Math.floor(Number(raw.perUser) || 1))),
    starts: date(raw.starts), ends: date(raw.ends), active: raw.active !== false, newUsersOnly: !!raw.newUsersOnly, note: String(raw.note || "").slice(0, 200),
  };
  if (v.starts && v.ends && v.ends < v.starts) throw bad("End date is before the start date.");
  if (kind === "percent" && !v.plans.length) throw bad("Pick at least one plan for the discount.");
  return v;
}

export function createPromo(raw: Partial<PromoInput>, by: string) {
  return tx((d) => {
    const v = validatePromo(d, raw);
    const p = { id: uid("pr"), uses: 0, redemptions: [], createdAt: nowISO(), ...v };
    d.promos.unshift(p);
    audit(d, by, "promo", "Created promo code", p.code, promoText(p));
    return p;
  });
}
export function updatePromo(id: string, raw: Partial<PromoInput>, by: string) {
  return tx((d) => {
    const p = d.promos.find((x) => x.id === id);
    if (!p) throw notFound();
    const v = validatePromo(d, { ...p, ...raw }, id);
    const wasActive = p.active;
    Object.assign(p, v);
    audit(d, by, "promo", wasActive !== p.active ? (p.active ? "Turned on promo" : "Paused promo") : "Edited promo code", p.code, promoText(p));
    return p;
  });
}
export function deletePromo(id: string, by: string) {
  return tx((d) => {
    const p = d.promos.find((x) => x.id === id);
    if (!p) throw notFound();
    d.promos = d.promos.filter((x) => x.id !== id);
    audit(d, by, "promo", "Deleted promo code", p.code, p.uses + " uses");
    return { ok: true };
  });
}
export const promoText = (p: Pick<PromoInput, "kind" | "value" | "plans">) =>
  p.kind === "credits" ? "+" + p.value + " credits" : p.kind === "percent" ? p.value + "% off " + p.plans.join(", ") : "+" + p.value + " trial days";

/** Called by your app at checkout or in settings when a student types a code. One redemption per call. */
export function redeemPromo(b: { code: string; userKey: string; isNewUser?: boolean; plan?: string; dryRun?: boolean }) {
  return tx((d) => {
    const code = String(b.code || "").trim().toUpperCase();
    const key = String(b.userKey || "").trim().toLowerCase();
    if (!key) throw bad("userKey is required (user id or email).");
    const p = d.promos.find((x) => x.code === code);
    const day = nowISO().slice(0, 10);
    const no = (reason: string) => ({ ok: false, reason });
    if (!p) return no("That code does not exist.");
    if (!p.active) return no("That code is paused.");
    if (p.starts && day < p.starts) return no("That code is not live yet.");
    if (p.ends && day > p.ends) return no("That code has expired.");
    if (p.maxUses && p.uses >= p.maxUses) return no("That code has been used up.");
    if (p.newUsersOnly && !b.isNewUser) return no("That code is for new accounts only.");
    if (p.kind === "percent" && b.plan && !p.plans.includes(b.plan)) return no("That code does not apply to this plan.");
    const hk = createHash("sha256").update(key).digest("hex").slice(0, 32);
    if (p.redemptions.filter((r) => r.userKey === hk).length >= p.perUser) return no("You have already used this code.");
    if (d.flags.emergency.stopSignupCredits && p.kind === "credits") return no("Codes are paused right now.");
    const out = { ok: true, kind: p.kind, value: p.value, plans: p.plans, reason: promoText(p) };
    if (b.dryRun) return out;
    p.uses++;
    p.redemptions.push({ userKey: hk, at: nowISO() });
    if (p.redemptions.length > 20000) p.redemptions.shift();
    audit(d, "system", "promo", "Code redeemed", p.code, promoText(p));
    return out;
  });
}

/** commitSlug: only then may a live post change its slug (and get a 301). Autosaves keep the old slug. */
export function savePost(p: Post, by: string, isNew = false, commitSlug = false) {
  return tx((d) => {
    const i = d.posts.findIndex((x) => x.id === p.id);
    if (i < 0 && !isNew) throw notFound();
    if (i >= 0 && isNew) throw bad("Post already exists.");
    if (!p.id || typeof p.title !== "string" || typeof p.body !== "string") throw bad("Not a valid post.");
    const prev = i >= 0 ? d.posts[i] : null;
    if (prev && prev.status === "published" && p.status === "published" && prev.slug !== p.slug && !commitSlug) p = { ...p, slug: prev.slug };
    if (p.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) throw bad("Slug: use a to z, 0 to 9 and single hyphens.");
    if (p.slug && d.posts.some((x) => x.id !== p.id && x.slug === p.slug)) throw bad("Another post already uses this slug.");
    // 301 when a live post changes slug
    if (prev && prev.status === "published" && prev.slug && p.slug && prev.slug !== p.slug) {
      const from = "/blog/" + prev.slug, to = "/blog/" + p.slug;
      d.seo.redirects.forEach((r) => { if (r.to === from) r.to = to; });
      d.seo.redirects = d.seo.redirects.filter((r) => r.from !== to);
      if (!d.seo.redirects.some((r) => r.from === from)) d.seo.redirects.push({ from, to });
    }
    if (p.status === "published" && !p.date) p = { ...p, date: nowISO().slice(0, 16) };
    const clean: Post = { ...p, updated: nowISO() };
    if (i >= 0) d.posts[i] = clean; else d.posts.unshift(clean);
    if (!prev || prev.status !== clean.status) audit(d, by, "content", isNew ? "Created post" : "Post " + clean.status, "/blog/" + clean.slug, clean.title || "Untitled");
    else if (prev.slug !== clean.slug && prev.status === "published") audit(d, by, "content", "Changed live slug", "/blog/" + clean.slug, "301 from /blog/" + prev.slug);
    return clean;
  });
}

export function deletePost(id: string, by: string) {
  return tx((d) => {
    const p = d.posts.find((x) => x.id === id);
    if (!p) throw notFound();
    d.posts = d.posts.filter((x) => x.id !== id);
    audit(d, by, "content", "Deleted post", "/blog/" + p.slug, p.title);
    return { ok: true };
  });
}

export function saveSeo(body: { bots?: Record<string, boolean>; redirects?: { from: string; to: string }[] }, by: string) {
  return tx((d) => {
    if (body.bots) for (const b of BOTS) if (!b[3] && b[0] in body.bots) d.seo.bots[b[0]] = !!body.bots[b[0]];
    if (body.redirects) d.seo.redirects = body.redirects.slice(0, 500).map((r) => ({ from: String(r.from || "").slice(0, 300), to: String(r.to || "").slice(0, 300) }));
    audit(d, by, "content", "Saved SEO settings", "seo", body.bots ? "crawlers" : "redirects");
    return d.seo;
  });
}

export function saveSite(next: Partial<Site>, by: string) {
  return tx((d) => {
    const ch: string[] = [];
    for (const k of Object.keys(d.site) as (keyof Site)[]) {
      if (next[k] !== undefined && String(next[k]) !== d.site[k]) { d.site[k] = String(next[k]).slice(0, 2000); ch.push(k); }
    }
    if (ch.length) audit(d, by, "system", "Saved settings", "site", ch.join(", "));
    return d.site;
  });
}

export function importData(o: Data, by: string) {
  return tx((d) => {
    if (!o || !Array.isArray(o.posts) || !o.site) throw bad("That is not valid Doubtster data.");
    const fresh = seed() as unknown as Record<string, unknown>;
    const rec = o as unknown as Record<string, unknown>;
    for (const k of Object.keys(fresh)) if (!(k in rec)) rec[k] = fresh[k];
    const keep = { audit: d.audit, admins: d.admins, sessions: d.sessions, invites: d.invites, security: d.security };
    Object.assign(d, o, { v: 2 }, keep);
    audit(d, by, "system", "Imported data", "backup", d.posts.length + " posts, " + d.users.length + " users");
    return { ok: true };
  });
}

export function resetData(by: string) {
  return tx((d) => {
    const keep = { audit: d.audit, admins: d.admins, sessions: d.sessions, invites: d.invites, security: d.security };
    Object.assign(d, seed(), keep);
    audit(d, by, "system", "Reset to sample data", "all", "");
    return { ok: true };
  });
}

export { emailDomain, matchCollege };
