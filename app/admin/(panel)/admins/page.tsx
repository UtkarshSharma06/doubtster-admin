import type { Metadata } from "next";
import { guard } from "@/lib/guard";
import { read } from "@/lib/store";
import { publicAdmin, shortUa } from "@/lib/admins";
import Admins from "@/components/views/Admins";

export const metadata: Metadata = { title: "Admins and access" };

export default async function Page() {
  const ctx = await guard("super");
  const d = await read();
  const now = new Date().toISOString();
  const sessions = d.sessions
    .filter((s) => !s.revoked && s.expiresAt > now)
    .map((s) => ({ id: s.id, adminId: s.adminId, email: d.admins.find((a) => a.id === s.adminId)?.email || "", device: shortUa(s.ua), ip: s.ip, lastSeen: s.lastSeen, current: s.id === ctx.session.id }))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  const invites = Object.fromEntries(d.invites.filter((i) => !i.usedAt && i.expiresAt > now).map((i) => [i.adminId, i.expiresAt]));
  return <Admins admins={d.admins.map(publicAdmin)} meId={ctx.admin.id} sessions={sessions} invites={invites} security={d.security} history={d.audit.filter((a) => a.type === "admins" || a.type === "security").slice(0, 30)} />;
}
