import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import Payments from "@/components/views/Payments";

export const metadata: Metadata = { title: "Payments" };

export default async function Page() {
  const ctx = await guard("payments");
  const d = await read();
  return <Payments payments={d.payments} grants={d.grants} users={d.users.map((u) => ({ id: u.id, name: u.name, plan: u.plan, credits: u.credits, expires: u.expires }))} trialDays={d.flags.trialDays} />;
}
