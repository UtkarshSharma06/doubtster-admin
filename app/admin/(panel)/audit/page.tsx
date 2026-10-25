import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import Audit from "@/components/views/Audit";

export const metadata: Metadata = { title: "Audit log" };

export default async function Page() {
  const ctx = await guard("audit");
  return <Audit audit={(await read()).audit.slice(0, 1000)} />;
}
