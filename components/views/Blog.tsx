"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Post } from "@/lib/types";
import { fmt, nowISO } from "@/lib/util";
import { api, Head, Pill, useAction, useArm } from "../ui";

type Row = { id: string; title: string; slug: string; status: Post["status"]; date: string; score: number; words: number };

export function newPost(author: string, lang: string): Post {
  return { id: "p" + Date.now().toString(36), title: "", slug: "", slugMode: "auto", status: "draft", date: "", updated: nowISO(), author, category: "", tags: [], lang, tldr: "", cover: "", coverAlt: "", body: "## Heading\n\nStart writing here.", focusKw: "", secondaryKw: [], metaTitle: "", metaDesc: "", canonical: "", robots: { index: true, follow: true, img: true }, ogTitle: "", ogDesc: "", ogImage: "", twitterCard: "summary_large_image", schema: { type: "BlogPosting", faq: true, breadcrumb: true }, faqs: [], sources: [], hreflang: [] };
}

export default function Blog({ posts, full, site }: { posts: Row[]; full: Post[]; site: { author: string; lang: string } }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const router = useRouter();
  const { run, busy } = useAction();
  const arm = useArm();
  const L = posts.filter((p) => (st === "all" || p.status === st) && (!q || (p.title + p.slug).toLowerCase().includes(q.toLowerCase())));
  async function create() {
    const p = newPost(site.author, site.lang);
    const r = await run(() => api("posts", "POST", p));
    if (r) router.push("/admin/blog/" + p.id);
  }
  function duplicate(id: string) {
    const src = full.find((x) => x.id === id);
    if (!src) return;
    let slug = src.slug + "-copy", n = 2;
    while (full.some((x) => x.slug === slug)) slug = src.slug + "-copy-" + n++;
    const p: Post = { ...structuredClone(src), id: "p" + Date.now().toString(36), title: src.title + " (copy)", slug, slugMode: "custom", status: "draft", date: "" };
    run(() => api("posts", "POST", p), "Duplicated as draft");
  }
  return (
    <>
      <Head title="Blog posts" sub="Write, optimise and publish posts that search engines and AI answers can find.">
        <Link className="btn" href="/admin/settings">Import / export</Link>
        <button className="btn primary" disabled={busy} onClick={create}>New post</button>
      </Head>
      <div className="card">
        <div className="row2" style={{ marginBottom: 10 }}>
          <input type="search" placeholder="Search posts" aria-label="Search posts" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}>{["all", "published", "scheduled", "draft"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="tw"><table>
          <thead><tr><th>Post</th><th>Status</th><th>SEO score</th><th>Words</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {L.map((p) => (
              <tr key={p.id}>
                <td><Link href={"/admin/blog/" + p.id}><b>{p.title || "Untitled"}</b></Link><br /><span style={{ color: "var(--mute)", fontFamily: "var(--mono)", fontSize: 12 }}>/blog/{p.slug}</span></td>
                <td><Pill c={{ published: "p-good", scheduled: "p-blue", draft: "p-mute" }[p.status]}>{p.status}</Pill></td>
                <td><Pill c={p.score >= 80 ? "p-good" : p.score >= 60 ? "p-warn" : "p-bad"}>{p.score}/100</Pill></td>
                <td>{p.words}</td><td>{fmt(p.date)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="btn sm" href={"/admin/blog/" + p.id}>Edit</Link>{" "}
                  <button className="btn sm" onClick={() => duplicate(p.id)}>Duplicate</button>{" "}
                  <button className="btn sm danger" onClick={() => arm.hit(p.id, () => run(() => api("posts/" + p.id, "DELETE"), "Post deleted"))}>{arm.armed === p.id ? "Sure?" : "Delete"}</button>
                </td>
              </tr>
            ))}
            {!L.length && <tr><td colSpan={6} style={{ color: "var(--mute)" }}>No posts yet. Click New post.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
