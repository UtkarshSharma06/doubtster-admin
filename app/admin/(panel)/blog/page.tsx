import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { read } from "@/lib/store";
import { analyze, score } from "@/lib/seo";
import Blog from "@/components/views/Blog";

export const metadata: Metadata = { title: "Blog posts" };

export default async function Page() {
  const ctx = await guard("blog");
  const d = await read();
  return (
    <Blog
      posts={d.posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, date: p.date || p.updated, score: score(p, d.site), words: analyze(p, d.site).words }))}
      full={d.posts}
      site={{ author: d.site.author, lang: d.site.lang }}
    />
  );
}
