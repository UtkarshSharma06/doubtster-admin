/*
  Roles and permissions. Shared by the server (enforcement) and the UI (what to show).
  The server is the only thing that actually decides. The UI just hides what you cannot use.
*/

export const SECTIONS = [
  ["overview", "Overview"],
  ["analytics", "Analytics"],
  ["colleges", "Colleges"],
  ["users", "Users"],
  ["payments", "Payments"],
  ["videos", "Videos"],
  ["controls", "App controls"],
  ["blog", "Blog posts"],
  ["seo", "SEO tools"],
  ["audit", "Audit log"],
  ["settings", "Settings"],
] as const;

export type Section = (typeof SECTIONS)[number][0];
export type Level = "none" | "view" | "edit";
export type Perms = Record<Section, Level>;
export type Role = "super" | "admin" | "support" | "content" | "growth" | "viewer" | "custom";

const all = (l: Level): Perms => Object.fromEntries(SECTIONS.map(([s]) => [s, l])) as Perms;

export const ROLES: Record<Exclude<Role, "custom">, { label: string; about: string; perms: Perms }> = {
  super: { label: "Super admin", about: "Everything, plus managing admins and security.", perms: all("edit") },
  admin: { label: "Admin", about: "Edit everything except admins, security and data reset.", perms: { ...all("edit"), settings: "view" } },
  support: { label: "Support", about: "Help students: users, payments and grants. Sees the rest.", perms: { ...all("view"), users: "edit", payments: "edit", controls: "view", settings: "none", audit: "view" } },
  content: { label: "Content", about: "Blog and SEO. Sees overview and analytics.", perms: { ...all("none"), overview: "view", analytics: "view", blog: "edit", seo: "edit" } },
  growth: { label: "Growth", about: "Colleges, promo codes and analytics.", perms: { ...all("none"), overview: "view", analytics: "view", colleges: "edit", users: "view", controls: "view" } },
  viewer: { label: "Viewer", about: "Can look at everything, change nothing, download nothing.", perms: { ...all("view"), settings: "none" } },
};

export const rank = (l: Level) => (l === "edit" ? 2 : l === "view" ? 1 : 0);

export function permsFor(role: Role, custom?: Partial<Perms>): Perms {
  if (role === "custom") {
    const p = all("none");
    for (const [s] of SECTIONS) {
      const v = custom?.[s];
      if (v === "view" || v === "edit") p[s] = v;
    }
    return p;
  }
  return ROLES[role].perms;
}

export const can = (perms: Perms, s: Section, need: Level) => rank(perms[s]) >= rank(need);

/** First page an admin is allowed to open. */
export const ROUTES: Record<Section, string> = {
  overview: "/admin", analytics: "/admin/analytics", colleges: "/admin/colleges", users: "/admin/users", payments: "/admin/payments",
  videos: "/admin/videos", controls: "/admin/controls", blog: "/admin/blog", seo: "/admin/seo", audit: "/admin/audit", settings: "/admin/settings",
};
export function homeFor(perms: Perms) {
  const s = SECTIONS.find(([k]) => perms[k] !== "none");
  return s ? ROUTES[s[0]] : "/admin/account";
}
