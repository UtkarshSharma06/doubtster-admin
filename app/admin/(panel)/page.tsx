import { guard } from "@/lib/guard";
import { read } from "@/lib/store";
import { score, published } from "@/lib/seo";
import { cStats } from "@/lib/util";
import Overview from "@/components/views/Overview";

export default async function Page() {
  const ctx = await guard("overview");
  const d = await read();
  const pub = published(d).length;
  const weak = d.posts.filter((p) => score(p, d.site) < 70).length;
  const noMeta = d.posts.filter((p) => !p.metaDesc).length;
  const colleges = d.colleges.map((c) => [c.name, cStats(c, d.users, d.flags).signups, c.active ? "" : " paused"] as [string, number, string]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <Overview blog={{ pub, drafts: d.posts.length - pub, weak, noMeta }} colleges={colleges} audit={d.audit.slice(0, 5)} />;
}
