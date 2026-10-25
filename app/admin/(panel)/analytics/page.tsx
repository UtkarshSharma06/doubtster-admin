import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import Analytics from "@/components/views/Analytics";

export const metadata: Metadata = { title: "Analytics" };

export default async function Page() {
  const ctx = await guard("analytics");
  const d = await read();
  const manual = d.grants.filter((g) => g.status === "active").reduce((a, g) => a + g.credits, 0);
  const bulk = d.creditGrants.filter((g) => g.source === "bulk_college" && g.status === "granted").reduce((a, g) => a + g.credits, 0);
  return <Analytics users={d.users} colleges={d.colleges.map((c) => ({ id: c.id, name: c.name }))} flags={d.flags} manual={manual} bulk={bulk} />;
}
