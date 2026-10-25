import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentCtx } from "@/lib/route";
import { read } from "@/lib/store";
import { publicAdmin, shortUa } from "@/lib/admins";
import Account from "@/components/views/Account";

export const metadata: Metadata = { title: "My account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const ctx = await currentCtx();
  if (!ctx) redirect("/admin/login");
  const d = await read();
  const { setup } = await searchParams;
  const sessions = d.sessions
    .filter((s) => s.adminId === ctx.admin.id && !s.revoked && s.expiresAt > new Date().toISOString())
    .map((s) => ({ id: s.id, device: shortUa(s.ua), ip: s.ip, createdAt: s.createdAt, lastSeen: s.lastSeen, current: s.id === ctx.session.id }))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  const activity = d.audit.filter((a) => a.type === "security" && (a.target === ctx.admin.email || a.by === ctx.admin.email)).slice(0, 12);
  return <Account me={publicAdmin(ctx.admin)} sessions={sessions} activity={activity} mustSetup={ctx.mustSetup2fa || setup === "2fa"} required={d.security.require2fa} />;
}
