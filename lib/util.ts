import type { College, Flags, User } from "./types";

export const nowISO = () => new Date().toISOString();
export const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";
}
export function ago(t: string) {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  if (m < 1440) return Math.round(m / 60) + " h ago";
  return fmt(t);
}
export const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
export const money = (n: number) =>
  "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function slugify(t: string) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 75).replace(/-+$/, "");
}
export function sanitizeSlug(v: string) {
  return String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 90);
}
export function clip(s: string, n: number) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  let c = s.slice(0, n + 1);
  c = c.slice(0, c.lastIndexOf(" ") > n * 0.6 ? c.lastIndexOf(" ") : n);
  return c.replace(/[,;:.\- ]+$/, "");
}
export function countBy<T>(arr: T[], fn: (x: T) => unknown): [string, number][] {
  const m: Record<string, number> = {};
  arr.forEach((x) => {
    let k = fn(x);
    if (k == null || k === "") k = "Unknown";
    m[String(k)] = (m[String(k)] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export const isPaid = (u: User) => u.plan === "Pro monthly" || u.plan === "Pro annual";
export function mrrOf(u: User, f: Flags) {
  if (u.status !== "active") return 0;
  if (u.plan === "Pro monthly") return Number(f.priceMonthly) || 0;
  if (u.plan === "Pro annual") return (Number(f.priceAnnual) || 0) / 12;
  return 0;
}

export interface CStats {
  signups: number; granted: number; credits: number; used: number; paid: number; conv: number; active7: number; videos: number; mrr: number;
}
export function cStats(c: College, users: User[], f: Flags): CStats {
  const U = users.filter((u) => u.collegeId === c.id);
  const paid = U.filter(isPaid);
  return {
    signups: U.length,
    granted: U.filter((u) => u.signupCredits > 0).length,
    credits: U.reduce((a, u) => a + (u.signupCredits || 0), 0),
    used: U.reduce((a, u) => a + (u.creditsUsed || 0), 0),
    paid: paid.length,
    conv: U.length ? (paid.length / U.length) * 100 : 0,
    active7: U.filter((u) => u.lastActive && daysAgo(u.lastActive) <= 7).length,
    videos: U.reduce((a, u) => a + (u.videos || 0), 0),
    mrr: U.reduce((a, u) => a + mrrOf(u, f), 0),
  };
}
