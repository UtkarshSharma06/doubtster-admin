import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import Users from "@/components/views/Users";

export const metadata: Metadata = { title: "Users" };

export default async function Page() {
  const ctx = await guard("users");
  const d = await read();
  return <Users users={d.users} colleges={d.colleges.map((c) => ({ id: c.id, name: c.name }))} trialDays={d.flags.trialDays} isSuper={ctx.admin.role === "super"} adminEmails={d.admins.map((a) => a.email)} />;
}
