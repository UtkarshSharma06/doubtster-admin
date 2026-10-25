import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import Videos from "@/components/views/Videos";

export const metadata: Metadata = { title: "Videos" };

export default async function Page() {
  const ctx = await guard("videos");
  return <Videos jobs={(await read()).jobs} />;
}
