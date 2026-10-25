import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import { cStats } from "@/lib/util";
import Colleges from "@/components/views/Colleges";

export const metadata: Metadata = { title: "Colleges" };

export default async function Page() {
  const ctx = await guard("colleges");
  const d = await read();
  return (
    <Colleges
      colleges={d.colleges.map((c) => ({ ...c, stats: cStats(c, d.users, d.flags) }))}
      users={d.users.filter((u) => u.collegeId).map((u) => ({ id: u.id, name: u.name, email: u.email, plan: u.plan, credits: u.credits, collegeId: u.collegeId }))}
      history={d.audit.filter((a) => a.type === "college" || a.type === "signup" || a.type === "credits").slice(0, 400)}
    />
  );
}
