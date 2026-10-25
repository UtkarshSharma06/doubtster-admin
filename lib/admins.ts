import "server-only";
import { read, tx } from "./store";
import type { Admin, Data, Security, Session } from "./types";
import { permsFor, ROLES, SECTIONS, type Perms, type Role } from "./perm";
import { checkPassword, hashPassword, passwordProblem, randomToken, sha256 } from "./password";
import { checkCode, newSecret, otpauthUrl, recoveryCodes } from "./totp";
import { HttpError, audit } from "./service";
import { nowISO, uid } from "./util";
import { seed } from "./seed";

const bad = (m: string) => new HttpError(400, m);
const forbid = (m = "You do not have access to that.") => new HttpError(403, m);
const norm = (e: string) => String(e || "").trim().toLowerCase();
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const ROLE_LIST: Role[] = ["super", "admin", "support", "content", "growth", "viewer", "custom"];

export interface Ctx { admin: Admin; perms: Perms; session: Session; mustSetup2fa: boolean }

/** What the browser may see about an admin. Never the hashes or secrets. */
export function publicAdmin(a: Admin) {
  return {
    id: a.id, email: a.email, name: a.name, role: a.role, perms: permsFor(a.role, a.perms), status: a.status,
    twoFactor: !!a.totpSecret, recoveryLeft: a.recoveryHashes.length, locked: !!a.lockedUntil && a.lockedUntil > nowISO(),
    createdAt: a.createdAt, createdBy: a.createdBy, lastLogin: a.lastLogin, lastIp: a.lastIp, userId: a.userId,
  };
}
export type PublicAdmin = ReturnType<typeof publicAdmin>;

/* ---------- IP allowlist ---------- */
function ip4(ip: string) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip.replace(/^::ffff:/, ""));
  return m ? m.slice(1).reduce((a, x) => (a << 8) + Number(x), 0) >>> 0 : null;
}
export function ipAllowed(ip: string, list: string[]) {
  if (!list.length) return true;
  return list.some((rule) => {
    rule = rule.trim();
    if (!rule) return false;
    if (rule === ip) return true;
    const [base, bits] = rule.split("/");
    const a = ip4(ip), b = ip4(base);
    if (a === null || b === null || bits === undefined) return false;
    const n = Number(bits);
    if (!(n >= 0 && n <= 32)) return false;
    const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
    return (a & mask) === (b & mask);
  });
}

/* ---------- sessions ---------- */
function newSession(d: Data, adminId: string, ip: string, ua: string) {
  const now = Date.now();
  d.sessions = d.sessions.filter((s) => !s.revoked && s.expiresAt > nowISO()).slice(-500);
  const s: Session = {
    id: randomToken(24), adminId, createdAt: nowISO(), lastSeen: nowISO(),
    expiresAt: new Date(now + d.security.sessionHours * 3600e3).toISOString(), ip, ua: ua.slice(0, 200), revoked: false,
  };
  d.sessions.push(s);
  return s;
}

/** Loads the signed-in admin from a session id. Returns null if anything is off. */
export async function contextFor(sid: string | null, ip: string, tokenData?: { aid?: string; email?: string } | null): Promise<Ctx | null> {
  if (!sid) return null;
  const d = await read();
  let s = d.sessions.find((x) => x.id === sid);

  const adminId = s?.adminId || tokenData?.aid;
  const adminEmail = tokenData?.email;

  let a = d.admins.find((x) => (adminId && x.id === adminId) || (adminEmail && x.email === adminEmail));
  if (!a) {
    const seeded = seed();
    a = seeded.admins.find((x) => (adminId && x.id === adminId) || (adminEmail && x.email === adminEmail));
    if (a) {
      d.admins.push(a);
    }
  }

  if (!a || a.status !== "active") return null;

  if (s && s.revoked) return null;
  if (s && s.expiresAt < nowISO()) return null;
  if (s && Date.now() - new Date(s.lastSeen).getTime() > d.security.idleMinutes * 60e3) return null;

  if (!s) {
    s = {
      id: sid,
      adminId: a.id,
      createdAt: nowISO(),
      lastSeen: nowISO(),
      expiresAt: new Date(Date.now() + d.security.sessionHours * 3600e3).toISOString(),
      ip,
      ua: "verified-session",
      revoked: false,
    };
    d.sessions.push(s);
  }

  if (a.role !== "super" && !ipAllowed(ip, d.security.ipAllowlist)) return null;
  if (Date.now() - new Date(s.lastSeen).getTime() > 120e3) {
    tx((dd) => { const ss = dd.sessions.find((x) => x.id === sid); if (ss) { ss.lastSeen = nowISO(); ss.ip = ip; } }).catch(() => {});
  }
  return { admin: a, perms: permsFor(a.role, a.perms), session: s, mustSetup2fa: d.security.require2fa && !a.totpSecret };
}

/* ---------- login ---------- */
export type LoginResult = { kind: "ok"; sid: string; aid?: string; email?: string; exp: number } | { kind: "2fa"; adminId: string } | { kind: "fail"; message: string };

/** First run: if there are no admins yet, the env login becomes the super admin. */
async function bootstrap(email: string, password: string) {
  const E = norm(process.env.ADMIN_EMAIL || ""), P = process.env.ADMIN_PASSWORD || "";
  const d = await read();
  if (d.admins.length || !E || P.length < 10) return;
  if (email !== E || password !== P) return;
  const passHash = await hashPassword(password);
  await tx((dd) => {
    if (dd.admins.length) return;
    dd.admins.push({
      id: uid("ad"), email: E, name: E.split("@")[0], role: "super", perms: permsFor("super"), passHash, status: "active",
      totpSecret: "", totpPending: "", recoveryHashes: [], failed: 0, lockedUntil: "", createdAt: nowISO(), createdBy: "setup", lastLogin: "", lastIp: "", userId: "",
    });
    audit(dd, E, "admins", "Created first super admin", E, "from env on first sign in");
  });
}

export async function login(emailRaw: string, password: string, ip: string, ua: string): Promise<LoginResult> {
  const email = norm(emailRaw);
  await bootstrap(email, password);
  const d = await read();
  const a = d.admins.find((x) => x.email === email);
  const ok = await checkPassword(password, a?.passHash || "");
  const generic: LoginResult = { kind: "fail", message: "Wrong email or password." };
  if (!a) return generic;
  if (a.lockedUntil && a.lockedUntil > nowISO()) return { kind: "fail", message: "Too many wrong tries. This account is locked for a few minutes." };
  if (!ok) {
    await tx((dd) => {
      const x = dd.admins.find((y) => y.id === a.id)!;
      x.failed++;
      if (x.failed >= dd.security.maxFailed) {
        x.lockedUntil = new Date(Date.now() + dd.security.lockMinutes * 60e3).toISOString();
        x.failed = 0;
        audit(dd, x.email, "security", "Account locked", x.email, "too many wrong passwords", ip);
      }
    });
    return generic;
  }
  if (a.status === "disabled") return { kind: "fail", message: "This admin account is turned off. Ask your super admin." };
  if (a.status !== "active") return { kind: "fail", message: "Finish setting up your account from the invite link first." };
  if (a.role !== "super" && !ipAllowed(ip, d.security.ipAllowlist)) {
    await tx((dd) => audit(dd, a.email, "security", "Sign in blocked", a.email, "IP not on allowlist", ip));
    return { kind: "fail", message: "Sign in from this network is not allowed." };
  }
  if (a.totpSecret) return { kind: "2fa", adminId: a.id };
  return finishLogin(a.id, ip, ua, "password");
}

async function finishLogin(adminId: string, ip: string, ua: string, how: string): Promise<LoginResult> {
  return tx((d) => {
    const a = d.admins.find((x) => x.id === adminId)!;
    a.failed = 0; a.lockedUntil = ""; a.lastLogin = nowISO(); a.lastIp = ip;
    const s = newSession(d, a.id, ip, ua);
    audit(d, a.email, "security", "Signed in", a.email, how + (ua ? " · " + shortUa(ua) : ""), ip);
    return { kind: "ok" as const, sid: s.id, aid: a.id, email: a.email, exp: new Date(s.expiresAt).getTime() };
  });
}

export async function loginSecondStep(adminId: string, code: string, ip: string, ua: string): Promise<LoginResult> {
  const d = await read();
  const a = d.admins.find((x) => x.id === adminId);
  if (!a || a.status !== "active" || !a.totpSecret) return { kind: "fail", message: "Start again." };
  if (a.lockedUntil && a.lockedUntil > nowISO()) return { kind: "fail", message: "Too many wrong tries. Wait a few minutes." };
  const c = String(code || "").trim();
  if (checkCode(a.totpSecret, c)) return finishLogin(a.id, ip, ua, "password + authenticator");
  const rc = sha256(c.toUpperCase().replace(/[\s-]+/g, ""));
  if (a.recoveryHashes.includes(rc)) {
    await tx((dd) => { const x = dd.admins.find((y) => y.id === a.id)!; x.recoveryHashes = x.recoveryHashes.filter((h) => h !== rc); });
    return finishLogin(a.id, ip, ua, "password + recovery code");
  }
  await tx((dd) => {
    const x = dd.admins.find((y) => y.id === a.id)!;
    x.failed++;
    if (x.failed >= dd.security.maxFailed) { x.lockedUntil = new Date(Date.now() + dd.security.lockMinutes * 60e3).toISOString(); x.failed = 0; audit(dd, x.email, "security", "Account locked", x.email, "too many wrong codes", ip); }
  });
  return { kind: "fail", message: "That code did not work. Codes change every 30 seconds." };
}

export async function logout(sid: string) {
  await tx((d) => {
    const s = d.sessions.find((x) => x.id === sid);
    if (!s) return;
    s.revoked = true;
    const a = d.admins.find((x) => x.id === s.adminId);
    if (a) audit(d, a.email, "security", "Signed out", a.email, "");
  });
}

function shortUa(ua: string) {
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const o = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return b + (o ? " on " + o : "");
}
export { shortUa };

/* ---------- managing admins (super admin only) ---------- */
function requireSuper(ctx: Ctx) { if (ctx.admin.role !== "super") throw forbid("Only a super admin can manage admins."); }
const activeSupers = (d: Data) => d.admins.filter((a) => a.role === "super" && a.status === "active");

function cleanPerms(raw: unknown): Perms {
  const p = permsFor("custom", (raw || {}) as Partial<Perms>);
  return p;
}

function makeInvite(d: Data, adminId: string, kind: "invite" | "reset", by: string) {
  const token = randomToken(32);
  d.invites = d.invites.filter((i) => !(i.adminId === adminId && !i.usedAt)); // old links stop working
  d.invites.push({ id: uid("iv"), tokenHash: sha256(token), adminId, kind, expiresAt: new Date(Date.now() + d.security.inviteHours * 3600e3).toISOString(), usedAt: "", createdBy: by });
  return token;
}

export function inviteAdmin(ctx: Ctx, b: { email: string; name?: string; role: Role; perms?: Partial<Perms>; userId?: string }) {
  requireSuper(ctx);
  return tx((d) => {
    const email = norm(b.email);
    if (!isEmail(email)) throw bad("Enter a valid email.");
    if (!ROLE_LIST.includes(b.role)) throw bad("Pick a role.");
    if (d.admins.some((a) => a.email === email)) throw bad("That email already has admin access.");
    const a: Admin = {
      id: uid("ad"), email, name: String(b.name || "").trim().slice(0, 60) || email.split("@")[0], role: b.role,
      perms: b.role === "custom" ? cleanPerms(b.perms) : permsFor(b.role), passHash: "", status: "invited", totpSecret: "", totpPending: "",
      recoveryHashes: [], failed: 0, lockedUntil: "", createdAt: nowISO(), createdBy: ctx.admin.email, lastLogin: "", lastIp: "", userId: b.userId || "",
    };
    d.admins.push(a);
    const token = makeInvite(d, a.id, "invite", ctx.admin.email);
    audit(d, ctx.admin.email, "admins", b.userId ? "Gave admin access to a user" : "Invited admin", email, roleLabel(a.role));
    return { admin: publicAdmin(a), token };
  });
}

export function promoteUser(ctx: Ctx, userId: string, role: Role, perms?: Partial<Perms>) {
  return read().then((d) => {
    const u = d.users.find((x) => x.id === userId);
    if (!u) throw new HttpError(404, "User not found.");
    return inviteAdmin(ctx, { email: u.email, name: u.name, role, perms, userId });
  });
}

const roleLabel = (r: Role) => (r === "custom" ? "Custom" : ROLES[r].label);

export function updateAdmin(ctx: Ctx, id: string, b: { name?: string; role?: Role; perms?: Partial<Perms>; status?: "active" | "disabled" }) {
  requireSuper(ctx);
  return tx((d) => {
    const a = d.admins.find((x) => x.id === id);
    if (!a) throw new HttpError(404, "Admin not found.");
    const ch: string[] = [];
    if (b.name !== undefined && b.name.trim() && b.name.trim() !== a.name) { a.name = b.name.trim().slice(0, 60); ch.push("name"); }
    if (b.role !== undefined && b.role !== a.role) {
      if (!ROLE_LIST.includes(b.role)) throw bad("Pick a role.");
      if (a.id === ctx.admin.id) throw bad("You cannot change your own role.");
      if (a.role === "super" && activeSupers(d).length <= 1) throw bad("Keep at least one active super admin.");
      ch.push("role " + roleLabel(a.role) + " → " + roleLabel(b.role));
      a.role = b.role;
    }
    if (b.perms !== undefined && a.role === "custom") {
      const np = cleanPerms(b.perms);
      const diff = SECTIONS.filter(([s]) => np[s] !== a.perms[s]).map(([s, l]) => l + " " + a.perms[s] + " → " + np[s]);
      if (diff.length) { a.perms = np; ch.push(...diff); }
    }
    if (a.role !== "custom") a.perms = permsFor(a.role);
    if (b.status !== undefined && b.status !== a.status && a.status !== "invited") {
      if (a.id === ctx.admin.id) throw bad("You cannot turn off your own account.");
      if (b.status === "disabled" && a.role === "super" && activeSupers(d).length <= 1) throw bad("Keep at least one active super admin.");
      a.status = b.status;
      ch.push(b.status === "disabled" ? "turned off" : "turned on");
      if (b.status === "disabled") d.sessions.forEach((s) => { if (s.adminId === a.id) s.revoked = true; });
    }
    if (ch.length) audit(d, ctx.admin.email, "admins", "Changed admin", a.email, ch.join("; "));
    return publicAdmin(a);
  });
}

export function removeAdmin(ctx: Ctx, id: string) {
  requireSuper(ctx);
  return tx((d) => {
    const a = d.admins.find((x) => x.id === id);
    if (!a) throw new HttpError(404, "Admin not found.");
    if (a.id === ctx.admin.id) throw bad("You cannot remove yourself.");
    if (a.role === "super" && a.status === "active" && activeSupers(d).length <= 1) throw bad("Keep at least one active super admin.");
    d.admins = d.admins.filter((x) => x.id !== id);
    d.sessions.forEach((s) => { if (s.adminId === id) s.revoked = true; });
    d.invites = d.invites.filter((i) => i.adminId !== id);
    audit(d, ctx.admin.email, "admins", "Removed admin", a.email, roleLabel(a.role));
    return { ok: true };
  });
}

/** New link: for an invite that expired, or a password reset. Old links stop working. */
export function newLink(ctx: Ctx, id: string) {
  requireSuper(ctx);
  return tx((d) => {
    const a = d.admins.find((x) => x.id === id);
    if (!a) throw new HttpError(404, "Admin not found.");
    const kind = a.status === "invited" ? "invite" : "reset";
    const token = makeInvite(d, a.id, kind, ctx.admin.email);
    audit(d, ctx.admin.email, "admins", kind === "invite" ? "New invite link" : "Password reset link", a.email, "valid " + d.security.inviteHours + " h");
    return { token, kind };
  });
}

export function adminAction(ctx: Ctx, id: string, action: "signout" | "unlock" | "reset2fa") {
  requireSuper(ctx);
  return tx((d) => {
    const a = d.admins.find((x) => x.id === id);
    if (!a) throw new HttpError(404, "Admin not found.");
    if (action === "signout") { d.sessions.forEach((s) => { if (s.adminId === id && s.id !== ctx.session.id) s.revoked = true; }); audit(d, ctx.admin.email, "security", "Signed out everywhere", a.email, ""); }
    if (action === "unlock") { a.lockedUntil = ""; a.failed = 0; audit(d, ctx.admin.email, "security", "Unlocked account", a.email, ""); }
    if (action === "reset2fa") {
      if (a.id === ctx.admin.id) throw bad("Turn off your own 2FA from My account.");
      a.totpSecret = ""; a.totpPending = ""; a.recoveryHashes = [];
      audit(d, ctx.admin.email, "security", "Reset 2FA", a.email, "they must set it up again");
    }
    return publicAdmin(a);
  });
}

export function revokeSession(ctx: Ctx, sid: string) {
  return tx((d) => {
    const s = d.sessions.find((x) => x.id === sid);
    if (!s) throw new HttpError(404, "Session not found.");
    if (s.adminId !== ctx.admin.id && ctx.admin.role !== "super") throw forbid();
    s.revoked = true;
    const a = d.admins.find((x) => x.id === s.adminId);
    audit(d, ctx.admin.email, "security", "Ended a session", a?.email || "", shortUa(s.ua) + " · " + s.ip);
    return { ok: true };
  });
}

export function saveSecurity(ctx: Ctx, b: Partial<Security>) {
  requireSuper(ctx);
  return tx((d) => {
    const s = d.security, ch: string[] = [];
    const num = (k: "sessionHours" | "idleMinutes" | "maxFailed" | "lockMinutes" | "inviteHours", lo: number, hi: number) => {
      if (b[k] === undefined) return;
      const v = Math.floor(Number(b[k]));
      if (!(v >= lo && v <= hi)) throw bad(k + " must be " + lo + " to " + hi + ".");
      if (v !== s[k]) { s[k] = v; ch.push(k + " " + v); }
    };
    num("sessionHours", 1, 72); num("idleMinutes", 5, 1440); num("maxFailed", 3, 20); num("lockMinutes", 1, 1440); num("inviteHours", 1, 168);
    if (b.require2fa !== undefined && !!b.require2fa !== s.require2fa) { s.require2fa = !!b.require2fa; ch.push("require 2FA " + (s.require2fa ? "on" : "off")); }
    if (b.ipAllowlist !== undefined) {
      const list = (Array.isArray(b.ipAllowlist) ? b.ipAllowlist : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
      for (const r of list) if (!/^[\d.:a-fA-F]+(\/\d{1,3})?$/.test(r)) throw bad("Not an IP or range: " + r);
      if (JSON.stringify(list) !== JSON.stringify(s.ipAllowlist)) { s.ipAllowlist = list; ch.push("IP allowlist (" + list.length + ")"); }
    }
    if (ch.length) audit(d, ctx.admin.email, "security", "Changed security settings", "security", ch.join("; "));
    return s;
  });
}

/* ---------- invite links ---------- */
export async function inviteInfo(token: string) {
  const d = await read();
  const inv = d.invites.find((i) => i.tokenHash === sha256(String(token || "")));
  if (!inv || inv.usedAt || inv.expiresAt < nowISO()) return null;
  const a = d.admins.find((x) => x.id === inv.adminId);
  if (!a || a.status === "disabled") return null;
  return { email: a.email, name: a.name, kind: inv.kind, role: roleLabel(a.role), expiresAt: inv.expiresAt, require2fa: d.security.require2fa };
}

export async function acceptInvite(token: string, password: string, name: string, ip: string, ua: string): Promise<LoginResult> {
  const info = await inviteInfo(token);
  if (!info) throw bad("This link has expired or was already used. Ask your super admin for a new one.");
  const prob = passwordProblem(password, info.email);
  if (prob) throw bad(prob);
  const passHash = await hashPassword(password);
  const adminId = await tx((d) => {
    const inv = d.invites.find((i) => i.tokenHash === sha256(token));
    if (!inv || inv.usedAt || inv.expiresAt < nowISO()) throw bad("This link has expired.");
    const a = d.admins.find((x) => x.id === inv.adminId)!;
    inv.usedAt = nowISO();
    a.passHash = passHash;
    if (a.status === "invited") a.status = "active";
    if (name.trim()) a.name = name.trim().slice(0, 60);
    a.failed = 0; a.lockedUntil = "";
    d.sessions.forEach((s) => { if (s.adminId === a.id) s.revoked = true; });
    audit(d, a.email, "admins", inv.kind === "invite" ? "Accepted invite" : "Reset password", a.email, "", ip);
    return a.id;
  });
  const d = await read();
  const a = d.admins.find((x) => x.id === adminId)!;
  if (a.totpSecret) return { kind: "2fa", adminId };
  return finishLogin(adminId, ip, ua, "invite link");
}

/* ---------- my account ---------- */
export function changeName(ctx: Ctx, name: string) {
  return tx((d) => { const a = d.admins.find((x) => x.id === ctx.admin.id)!; a.name = name.trim().slice(0, 60) || a.name; return publicAdmin(a); });
}

export async function changePassword(ctx: Ctx, current: string, next: string) {
  if (!(await checkPassword(current, ctx.admin.passHash))) throw bad("Your current password is not right.");
  const prob = passwordProblem(next, ctx.admin.email);
  if (prob) throw bad(prob);
  const h = await hashPassword(next);
  return tx((d) => {
    const a = d.admins.find((x) => x.id === ctx.admin.id)!;
    a.passHash = h;
    d.sessions.forEach((s) => { if (s.adminId === a.id && s.id !== ctx.session.id) s.revoked = true; });
    audit(d, a.email, "security", "Changed password", a.email, "other sessions signed out");
    return { ok: true };
  });
}

export async function start2fa(ctx: Ctx) {
  const secret = newSecret();
  await tx((d) => { d.admins.find((x) => x.id === ctx.admin.id)!.totpPending = secret; });
  const QR = await import("qrcode");
  const url = otpauthUrl(secret, ctx.admin.email);
  const svg = await QR.toString(url, { type: "svg", margin: 1, width: 200 });
  return { secret, svg };
}

export function confirm2fa(ctx: Ctx, code: string) {
  return tx((d) => {
    const a = d.admins.find((x) => x.id === ctx.admin.id)!;
    if (!a.totpPending) throw bad("Start the setup again.");
    if (!checkCode(a.totpPending, code)) throw bad("That code did not work. Check the time on your phone and try the newest code.");
    a.totpSecret = a.totpPending; a.totpPending = "";
    const codes = recoveryCodes();
    a.recoveryHashes = codes.map((c) => sha256(c.toUpperCase().replace(/-/g, "")));
    audit(d, a.email, "security", "Turned on 2FA", a.email, "");
    return { codes };
  });
}

export async function disable2fa(ctx: Ctx, password: string) {
  const d0 = await read();
  if (d0.security.require2fa) throw bad("Your super admin requires 2FA for everyone.");
  if (!(await checkPassword(password, ctx.admin.passHash))) throw bad("Your password is not right.");
  return tx((d) => {
    const a = d.admins.find((x) => x.id === ctx.admin.id)!;
    a.totpSecret = ""; a.totpPending = ""; a.recoveryHashes = [];
    audit(d, a.email, "security", "Turned off 2FA", a.email, "");
    return { ok: true };
  });
}

export function newRecoveryCodes(ctx: Ctx) {
  return tx((d) => {
    const a = d.admins.find((x) => x.id === ctx.admin.id)!;
    if (!a.totpSecret) throw bad("Turn on 2FA first.");
    const codes = recoveryCodes();
    a.recoveryHashes = codes.map((c) => sha256(c.toUpperCase().replace(/-/g, "")));
    audit(d, a.email, "security", "New recovery codes", a.email, "old codes stop working");
    return { codes };
  });
}
