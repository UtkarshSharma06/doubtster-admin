"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { setReadOnly, ToastProvider } from "./ui";
import { ROLES, type Perms, type Role, type Section } from "@/lib/perm";

const I = {
  overview: <path d="M3 12l9-8 9 8M5 10v10h14V10" />,
  controls: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M21.5 20c0-2.8-1.6-4.8-4-5.6" /></>,
  payments: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  videos: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4.5-2.5z" /></>,
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  colleges: <path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6" />,
  blog: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" />,
  seo: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4M8 11l2 2 4-4" /></>,
  audit: <><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="9" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  admins: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
};
type K = keyof typeof I;
const GROUPS: [string, [K, string, string][]][] = [
  ["Control", [["overview", "Overview", "/admin"], ["controls", "App controls", "/admin/controls"], ["users", "Users", "/admin/users"], ["payments", "Payments", "/admin/payments"], ["videos", "Videos", "/admin/videos"]]],
  ["Growth", [["analytics", "Analytics", "/admin/analytics"], ["colleges", "Colleges", "/admin/colleges"]]],
  ["Content", [["blog", "Blog posts", "/admin/blog"], ["seo", "SEO tools", "/admin/seo"]]],
  ["System", [["audit", "Audit log", "/admin/audit"], ["settings", "Settings", "/admin/settings"]]],
  ["Team", [["admins", "Admins and access", "/admin/admins"], ["account", "My account", "/admin/account"]]],
];
const sectionOf = (path: string): Section | null => {
  const m = /^\/admin\/?([a-z]*)/.exec(path);
  const k = (m && m[1]) || "overview";
  return (["overview", "analytics", "colleges", "users", "payments", "videos", "controls", "blog", "seo", "audit", "settings"] as const).find((s) => s === k) || null;
};

export interface Me { name: string; email: string; role: Role; twoFactor: boolean }

export default function Shell({ children, me, perms, locked, siteUrl, badges, alerts }: { children: ReactNode; me: Me; perms: Perms; locked: boolean; siteUrl: string; badges: Partial<Record<K, number>>; alerts: string[] }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const sec = sectionOf(path);
  const ro = !!sec && perms[sec] === "view";
  useEffect(() => { setReadOnly(ro); }, [ro]);
  useEffect(() => setMenu(false), [path]);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const visible = (k: K) => (k === "admins" ? me.role === "super" : k === "account" ? true : !locked && perms[k as Section] !== "none");
  function theme() {
    const r = document.documentElement;
    const dark = r.getAttribute("data-theme") === "dark" || (!r.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    const t = dark ? "light" : "dark";
    r.setAttribute("data-theme", t);
    try { localStorage.setItem("dt_theme", t); } catch { /* private mode */ }
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }
  const roleLabel = me.role === "custom" ? "Custom access" : ROLES[me.role].label;
  return (
    <ToastProvider>
      <header className="bar">
        <div className="brand"><img src="/brand/doubtster-icon.svg" alt="" /><span>Doubtster</span><span className="pill">Admin</span></div>
        <div className="logo" aria-hidden="true">Doubtster</div>
        <div className="r">
          <a className="btn" id="viewsite" href={siteUrl} target="_blank" rel="noopener">View site ↗</a>
          <button className="btn" onClick={theme} aria-label="Toggle theme">Theme</button>
          <div className="me">
            <button className="avatar" aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu" onClick={() => setMenu(!menu)}>{(me.name || me.email).slice(0, 1).toUpperCase()}</button>
            {menu && (
              <div className="menu" role="menu">
                <div className="who"><b>{me.name}</b><span>{me.email}</span><span className={"pill " + (me.role === "super" ? "p-blue" : "p-mute")}>{roleLabel}</span></div>
                <Link href="/admin/account" role="menuitem">My account{!me.twoFactor && <span className="pill p-warn">2FA off</span>}</Link>
                {me.role === "super" && <Link href="/admin/admins" role="menuitem">Admins and access</Link>}
                <button role="menuitem" onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      {alerts.length > 0 && <div className="alertbar" role="status">{alerts.join(" · ")} <Link href="/admin/controls?tab=emergency">Review</Link></div>}
      <div className="shell">
        <nav className="side" aria-label="Admin">
          {GROUPS.map(([g, items]) => {
            const vis = items.filter(([k]) => visible(k));
            if (!vis.length) return null;
            return (
              <div key={g} style={{ display: "contents" }}>
                <div className="grp">{g}</div>
                {vis.map(([k, label, href]) => (
                  <Link key={k} href={href} className="nav" aria-current={active(href) ? "page" : undefined}>
                    <svg viewBox="0 0 24 24">{I[k]}</svg>{label}
                    {sec === k && perms[k as Section] === "view" ? <span className="badge ro-b">view</span> : badges[k] ? <span className="badge">{badges[k]}</span> : null}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <main className={"main" + (ro ? " ro" : "")}>
          {ro && <div className="robar">You can view this page but not change it. Ask a super admin for edit access.</div>}
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
