import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import { score } from "@/lib/seo";
import SeoTools from "@/components/views/SeoTools";

export const metadata: Metadata = { title: "SEO tools" };

export default async function Page() {
  const ctx = await guard("seo");
  const d = await read();
  const strong = d.posts.filter((p) => p.status === "published" && score(p, d.site) >= 80).length;
  return <SeoTools posts={d.posts.filter((p) => p.status === "published")} site={d.site} seo={d.seo} strong={strong} />;
}
