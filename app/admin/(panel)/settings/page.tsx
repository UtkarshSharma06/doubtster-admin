import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import Settings from "@/components/views/Settings";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const ctx = await guard("settings");
  return <Settings site={(await read()).site} isSuper={ctx.admin.role === "super"} />;
}
