import type { Metadata } from "next";
import { guard } from "@/lib/guard";
import { read } from "@/lib/store";
import Controls from "@/components/views/Controls";

export const metadata: Metadata = { title: "App controls" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await guard("controls");
  const d = await read();
  const { tab } = await searchParams;
  return (
    <Controls
      flags={d.flags}
      promos={d.promos.map(({ redemptions: _r, ...p }) => (void _r, p))}
      history={d.configHistory.map((h) => ({ id: h.id, at: h.at, by: h.by, changed: h.changed }))}
      initialTab={tab || "features"}
    />
  );
}
