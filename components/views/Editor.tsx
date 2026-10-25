"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post, Site } from "@/lib/types";
import { clip, nowISO, sanitizeSlug, slugify } from "@/lib/util";
import { analyze, checks, headTags, host, ldJson, md, postUrl, score } from "@/lib/seo";
import { api, CopyBox, Seg, Tabs, Toggle, useCopy, useToast } from "../ui";

type Tab = "seo" | "meta" | "social" | "schema" | "preview" | "publish";
const STOP = ["a", "an", "the", "of", "and", "or", "in", "on", "to", "for", "with", "is", "are", "how"];

let ctx: CanvasRenderingContext2D | null = null;
function px(text: string, font: string) {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export default function Editor({ post, site, otherSlugs }: { post: Post; site: Site; otherSlugs: string[] }) {
  const [p, setP] = useState<Post>(() => ({ ...post, slugMode: post.slugMode || (!post.slug || post.slug === slugify(post.title) ? "auto" : "custom") }));
  const [liveSlug, setLiveSlug] = useState(post.status === "published" ? post.slug : "");
  const [tab, setTab] = useState<Tab>("seo");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saved, setSaved] = useState<string>("Saved");
  const toast = useToast();
  const copy = useCopy();
  const body = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  const latest = useRef(p);
  latest.current = p;

  const send = useCallback(async (commitSlug = false, msg?: string) => {
    const cur = latest.current;
    setSaved("Saving...");
    try {
      const out = await api<Post>("posts/" + cur.id, "PUT", { post: { ...cur, slug: cur.slug.replace(/-+$/, "") }, commitSlug });
      setSaved("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (out.status === "published") setLiveSlug(out.slug);
      if (msg) toast(msg);
      return out;
    } catch (e) {
      setSaved("Not saved");
      toast((e as Error).message);
      return null;
    }
  }, [toast]);

  // Autosave 800 ms after the last change.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved("Unsaved");
    const t = setTimeout(() => send(), 800);
    return () => clearTimeout(t);
  }, [p, send]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saved === "Unsaved" || saved === "Saving...") { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [saved]);

  const set = (patch: Partial<Post>) => setP((cur) => {
    const next = { ...cur, ...patch };
    if ("title" in patch && next.slugMode === "auto" && next.status !== "published") next.slug = slugify(next.title);
    return next;
  });
  const commitSlug = (slug: string, extra: Partial<Post> = {}) => {
    const clean = slug.replace(/^-+|-+$/g, "");
    setP((cur) => ({ ...cur, ...extra, slug: clean }));
    latest.current = { ...latest.current, ...extra, slug: clean };
    if (liveSlug && clean && clean !== liveSlug) send(true, "301 redirect added from the old address");
  };

  const L = useMemo(() => checks(p, site), [p, site]);
  const sc = useMemo(() => score(p, site), [p, site]);
  const a = useMemo(() => analyze(p, site), [p, site]);
  const pass = L.filter((c) => c.st === "pass").length;
  const top = L.filter((c) => c.st !== "pass").sort((x, y) => y.w - x.w)[0];

  const slugMsg = (() => {
    const v = p.slug;
    let m: string, c = "ok";
    if (!v) { m = "The slug is empty. Type one or switch to Auto."; c = "bad"; }
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.replace(/-+$/, ""))) { m = "Use only a to z, 0 to 9 and single hyphens."; c = "bad"; }
    else if (otherSlugs.includes(v)) { m = "Another post already uses this slug. Pick a different one."; c = "bad"; }
    else if (v.length > 75) { m = "Too long (" + v.length + "). Keep it under 75 characters."; c = "warn"; }
    else {
      const w = v.split("-"), sw = w.filter((x) => STOP.includes(x)).length;
      m = "Looks good: " + w.length + " words." + (w.length > 6 ? " Shorter slugs (3 to 5 words) are easier to read and share." : "") + (sw > 2 ? ' Remove filler words like "the" and "of".' : "");
      if (w.length > 6 || sw > 2) c = "warn";
      if (p.focusKw && !v.includes(slugify(p.focusKw).split("-")[0])) { m += " Tip: include your focus keyword."; c = "warn"; }
    }
    if (liveSlug && v && v !== liveSlug) m += " This post is live. When you leave the field, a 301 redirect from /blog/" + liveSlug + " is added.";
    return { m, c };
  })();

  function tool(k: string) {
    const ta = body.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
    const map: Record<string, string> = {
      H2: "\n## " + (sel || "Heading") + "\n", H3: "\n### " + (sel || "Heading") + "\n", B: "**" + (sel || "bold") + "**", I: "*" + (sel || "italic") + "*",
      Link: "[" + (sel || "link text") + "](/blog/)", Image: "![describe the image](" + (sel || "/img/name.png") + ")", List: "\n- " + (sel || "item"),
      Quote: "\n> " + (sel || "quote"), Code: "`" + (sel || "code") + "`",
    };
    const r = map[k];
    set({ body: v.slice(0, s) + r + v.slice(e) });
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + r.length; });
  }

  const cnt = (v: string, mn: number, mx: number) => {
    const n = (v || "").length;
    return <span className={"cnt " + (n === 0 ? "" : n >= mn && n <= mx ? "ok" : n > mx ? "bad" : "warn")}>{n} / {mx}</span>;
  };
  const pxBar = (text: string, font: string, max: number) => {
    const w = px(text, font);
    return <div className="bar-px"><i style={{ width: Math.min(100, (w / max) * 100) + "%", background: w > max ? "var(--bad)" : "var(--good)" }} /></div>;
  };
  const txt = (k: keyof Post, label: string, o: { area?: boolean; rows?: number; type?: string; ph?: string; hint?: string; help?: string; min?: number; max?: number; px?: [string, number] } = {}) => {
    const v = String(p[k] ?? "");
    const id = "f_" + k;
    return (
      <>
        <label className="f" htmlFor={id}>{label}{o.max ? cnt(v, o.min || 0, o.max) : null}{o.hint && <small>{o.hint}</small>}</label>
        {o.area ? <textarea id={id} rows={o.rows || 3} value={v} placeholder={o.ph} onChange={(e) => set({ [k]: e.target.value } as Partial<Post>)} />
          : <input id={id} type={o.type || "text"} value={v} placeholder={o.ph} onChange={(e) => set({ [k]: e.target.value } as Partial<Post>)} />}
        {o.px ? pxBar(v || (k === "metaTitle" ? p.title : ""), o.px[0], o.px[1]) : null}
        {o.help && <p className="help">{o.help}</p>}
      </>
    );
  };
  const csvField = (k: "tags" | "secondaryKw", label: string) => <CsvInput id={"f_" + k} label={label} value={p[k]} onChange={(v) => set({ [k]: v } as Partial<Post>)} />;

  // SERP preview pieces
  const t = p.metaTitle || p.title || "Post title", dsc = p.metaDesc || clip(p.tldr, 155) || "Add a meta description.";
  const u = site.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), tw = px(t, "20px Arial");
  let tt = t; while (px(tt + "...", "20px Arial") > 600 && tt.length > 10 && px(tt, "20px Arial") > 600) tt = tt.slice(0, -1); if (tt !== t) tt = tt.trim() + "...";
  let dd = dsc; if (px(dd, "14px Arial") > 920) { while (px(dd + "...", "14px Arial") > 920) dd = dd.slice(0, -1); dd = dd.trim() + "..."; }
  const serp = (a1: string, b1: string) => (
    <><div className="u"><img src="/brand/doubtster-icon.svg" alt="" /><div><div style={{ color: "#202124", fontSize: 14 }}>{site.name}</div><div>{u} › blog › {p.slug}</div></div></div><div className="t">{a1}</div><div className="d">{b1}</div></>
  );
  const img = p.ogImage || p.cover || site.ogImage;
  const smx = "  <url>\n    <loc>" + (p.canonical || postUrl(site, p)) + "</loc>\n    <lastmod>" + (p.updated || p.date || nowISO()).slice(0, 10) + "</lastmod>\n  </url>";

  return (
    <>
      <div className="head">
        <div><Link className="btn sm" href="/admin/blog">← All posts</Link></div>
        <div className="acts">
          <span className="pill p-mute" id="saved">{saved}</span>
          <select aria-label="Status" style={{ width: "auto" }} value={p.status} onChange={(e) => { const s = e.target.value as Post["status"]; set({ status: s, date: s === "published" && !p.date ? new Date().toISOString().slice(0, 16) : p.date }); }}>
            <option>draft</option><option>scheduled</option><option>published</option>
          </select>
          <button className="btn primary" onClick={() => {
            const np: Partial<Post> = p.status === "draft" ? { status: "published", date: p.date || new Date().toISOString().slice(0, 16) } : {};
            latest.current = { ...p, ...np }; setP(latest.current);
            send(false, latest.current.status === "published" ? "Published" : "Saved");
          }}>{p.status === "published" ? "Update" : p.status === "draft" ? "Publish" : "Save"}</button>
        </div>
      </div>
      <div className="ed">
        <div className="win"><div className="tb"><i /><i /><i /><span>Post editor</span></div><div className="bd">
          <input className="title-in" type="text" placeholder="Post title (this becomes the H1)" aria-label="Post title" value={p.title} onChange={(e) => set({ title: e.target.value })} />
          <div className="slugbox">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 12 }}>Permalink</b>
              <Seg label="Slug mode" value={p.slugMode || "auto"} options={[["auto", "Auto from title"], ["custom", "Custom slug"]]} onChange={(m) => { if (m === "auto") commitSlug(slugify(p.title), { slugMode: "auto" }); else set({ slugMode: "custom" }); }} />
            </div>
            <div className="slugrow">
              <span>{u}/blog/</span>
              <input type="text" aria-label="Slug" size={34} readOnly={p.slugMode === "auto"} placeholder="my-custom-slug" value={p.slug}
                onChange={(e) => set({ slug: sanitizeSlug(e.target.value) })} onBlur={(e) => commitSlug(e.target.value)} />
              <button type="button" className="btn sm" style={{ marginLeft: 6 }} onClick={() => { const v = slugify(p.slug || p.title); commitSlug(v, v !== slugify(p.title) ? { slugMode: "custom" } : {}); }}>Clean up</button>
            </div>
            <div className={"slugmsg " + slugMsg.c}>{slugMsg.m}</div>
          </div>
          {txt("tldr", "Answer-first summary (TL;DR)", { area: true, rows: 3, min: 200, max: 400, hint: "40 to 60 words that answer the question. Shown at the top of the post." })}
          <div className="row2"><div>{txt("cover", "Cover image URL", { type: "url", ph: "https://..." })}</div><div>{txt("coverAlt", "Cover image alt text", { hint: "describe the picture" })}</div></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginTop: 14 }}>
            <b>Body <span style={{ fontWeight: 400, color: "var(--mute)" }}>(Markdown)</span></b>
            <Seg label="Write or preview" value={mode} options={[["write", "Write"], ["preview", "Preview"]]} onChange={setMode} />
          </div>
          {mode === "write" ? (
            <>
              <div className="tbx">
                {["H2", "H3", "B", "I", "Link", "Image", "List", "Quote", "Code"].map((k) => <button key={k} type="button" onClick={() => tool(k)}>{k}</button>)}
                <span className="help" style={{ margin: "0 0 0 6px" }}>Use H2 and H3 only. The title is the H1.</span>
              </div>
              <textarea id="body" ref={body} aria-label="Body" value={p.body} onChange={(e) => set({ body: e.target.value })} />
            </>
          ) : (
            <div className="prose" dangerouslySetInnerHTML={{ __html: "<h1>" + escHtml(p.title) + "</h1>" + (p.tldr ? "<blockquote><strong>In short:</strong> " + escHtml(p.tldr) + "</blockquote>" : "") + md(p.body) }} />
          )}
          <div className="outline">
            <b>{a.words}</b> words · <b>{a.h2.length}</b> H2 · <b>{a.h3}</b> H3 · {a.imgs.length} images · {a.inter} internal / {a.ext} external links · ~{Math.max(1, Math.round(a.words / 220))} min read
            {a.h2.map((h, i) => <div key={i}>→ {h}</div>)}
          </div>
          <h3 style={{ marginTop: 20 }}>FAQs</h3>
          <p className="help">Real questions readers ask, with short direct answers.</p>
          {p.faqs.map((f, i) => (
            <div className="faq" key={i}>
              <button className="btn sm x danger" onClick={() => set({ faqs: p.faqs.filter((_, j) => j !== i) })}>Remove</button>
              <label className="f" htmlFor={"fq" + i} style={{ marginTop: 0 }}>Question</label>
              <input id={"fq" + i} value={f.q} onChange={(e) => set({ faqs: p.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
              <label className="f" htmlFor={"fa" + i}>Answer</label>
              <textarea id={"fa" + i} rows={2} value={f.a} onChange={(e) => set({ faqs: p.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
            </div>
          ))}
          <button className="btn sm" onClick={() => set({ faqs: [...p.faqs, { q: "", a: "" }] })}>Add question</button>
          <h3 style={{ marginTop: 20 }}>Sources</h3>
          <p className="help">Cite where facts come from. This builds trust with readers and AI answers.</p>
          {p.sources.map((f, i) => (
            <div className="faq" key={i}>
              <button className="btn sm x danger" onClick={() => set({ sources: p.sources.filter((_, j) => j !== i) })}>Remove</button>
              <label className="f" htmlFor={"st" + i} style={{ marginTop: 0 }}>Title</label>
              <input id={"st" + i} value={f.title} onChange={(e) => set({ sources: p.sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <label className="f" htmlFor={"su" + i}>URL</label>
              <input id={"su" + i} type="url" value={f.url} onChange={(e) => set({ sources: p.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            </div>
          ))}
          <button className="btn sm" onClick={() => set({ sources: [...p.sources, { title: "", url: "" }] })}>Add source</button>
        </div></div>

        <div className="rp">
          <div className="board">
            <div className="sc"><div className="num">{sc}<small>/100</small></div><div><div className="lb">{sc >= 80 ? "Looking strong" : sc >= 60 ? "Getting there" : "Needs work"}</div><div style={{ fontSize: 12, opacity: 0.8 }}>{pass} of {L.length} checks passed</div></div></div>
            <div className="meter"><i style={{ width: sc + "%" }} /></div>
            {top ? <div style={{ fontSize: 13, marginTop: 8 }}><span style={{ fontFamily: "var(--hand)", fontSize: 20 }}>Fix first:</span> {top.label}</div> : <div style={{ fontFamily: "var(--hand)", fontSize: 22, marginTop: 6 }}>All checks pass.</div>}
          </div>
          <div className="card" style={{ padding: "10px 14px" }}>
            <Tabs value={tab} onChange={setTab} options={[["seo", "Checks"], ["meta", "Meta"], ["social", "Social"], ["schema", "Schema and AI"], ["preview", "Preview"], ["publish", "Publish"]]} />
            {tab === "seo" && (
              <div className="chk">
                {Array.from(new Set(L.map((c) => c.g))).map((g) => (
                  <div key={g}>
                    <h4>{g}</h4>
                    <ul className="chk">
                      {L.filter((c) => c.g === g).map((c) => (
                        <li key={c.label}>
                          <span className={"ic " + c.st}>{c.st === "pass" ? "✓" : c.st === "warn" ? "!" : "×"}</span>
                          <span>{c.label}{c.st !== "pass" && c.msg && <><br /><span className="m">{c.msg}</span></>}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {tab === "meta" && (
              <>
                {txt("focusKw", "Focus keyword", { hint: "the one phrase to rank for", help: 'Pick something people actually search, such as "boat and stream problems".' })}
                {csvField("secondaryKw", "Secondary keywords")}
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn sm" onClick={() => { const k = p.focusKw ? p.focusKw.replace(/\b\w/g, (c) => c.toUpperCase()) : ""; let mt = clip((k && !p.title.toLowerCase().includes(p.focusKw.toLowerCase()) ? k + ": " : "") + p.title, 56) + " | " + site.name; if (mt.length > 60) mt = clip(p.title, 60); set({ metaTitle: mt }); }}>Fill SEO title</button>
                  <button className="btn sm" onClick={() => set({ metaDesc: clip(p.tldr, 155) })}>Fill description from summary</button>
                </div>
                {txt("metaTitle", "SEO title", { min: 30, max: 60, px: ["20px Arial", 600], hint: "shown in Google", ph: p.title })}
                {txt("metaDesc", "Meta description", { area: true, rows: 3, min: 120, max: 160, px: ["14px Arial", 920], hint: "shown under the title" })}
                {txt("canonical", "Canonical URL", { type: "url", ph: postUrl(site, p), help: "Leave empty to use the post address. Set it only if the same content exists elsewhere." })}
                <div className="row2"><div>{txt("category", "Category")}</div><div>{csvField("tags", "Tags")}</div></div>
                <div className="row2">
                  <div>{txt("author", "Author")}</div>
                  <div><label className="f" htmlFor="f_lang">Language</label><select id="f_lang" value={p.lang} onChange={(e) => set({ lang: e.target.value })}>{["en", "fr", "es", "hi"].map((l) => <option key={l}>{l}</option>)}</select></div>
                </div>
                <Toggle id="ri" title="Allow search engines to index" sub="Turn off for noindex" checked={p.robots.index} onChange={(v) => set({ robots: { ...p.robots, index: v } })} />
                <Toggle id="rf" title="Allow following links" checked={p.robots.follow} onChange={(v) => set({ robots: { ...p.robots, follow: v } })} />
                <Toggle id="rimg" title="Allow large image previews" sub="max-image-preview:large" checked={p.robots.img} onChange={(v) => set({ robots: { ...p.robots, img: v } })} />
                <h3 style={{ marginTop: 14 }}>Translations (hreflang)</h3>
                <p className="help">Link this post to its French, Spanish or Hindi version so the right one shows in each country.</p>
                {p.hreflang.map((h, i) => (
                  <div className="row2" key={i} style={{ marginBottom: 6 }}>
                    <select aria-label="Language" value={h.lang} onChange={(e) => set({ hreflang: p.hreflang.map((x, j) => (j === i ? { ...x, lang: e.target.value } : x)) })}>{["en", "fr", "es", "hi", "de", "pt", "it"].map((l) => <option key={l}>{l}</option>)}</select>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="url" aria-label="Translation URL" placeholder="https://..." value={h.url} onChange={(e) => set({ hreflang: p.hreflang.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                      <button className="btn sm danger" aria-label="Remove translation" onClick={() => set({ hreflang: p.hreflang.filter((_, j) => j !== i) })}>x</button>
                    </div>
                  </div>
                ))}
                <button className="btn sm" onClick={() => set({ hreflang: [...p.hreflang, { lang: "fr", url: "" }] })}>Add translation</button>
              </>
            )}
            {tab === "social" && (
              <>
                <p className="help" style={{ marginTop: 0 }}>Leave empty to reuse the SEO title and description.</p>
                {txt("ogTitle", "Social title", { max: 70 })}
                {txt("ogDesc", "Social description", { area: true, rows: 3, max: 200 })}
                {txt("ogImage", "Social image URL", { type: "url", ph: p.cover || site.ogImage, help: "Use 1200 x 630 pixels. Falls back to the cover image, then the site default." })}
                <label className="f" htmlFor="f_tc">Twitter / X card</label>
                <select id="f_tc" value={p.twitterCard} onChange={(e) => set({ twitterCard: e.target.value })}><option value="summary_large_image">Large image</option><option value="summary">Small summary</option></select>
              </>
            )}
            {tab === "schema" && (
              <>
                <label className="f" htmlFor="f_st">Article type</label>
                <select id="f_st" value={p.schema.type} onChange={(e) => set({ schema: { ...p.schema, type: e.target.value } })}>{["BlogPosting", "Article", "TechArticle"].map((l) => <option key={l}>{l}</option>)}</select>
                <Toggle id="sf" title="Include FAQPage markup" sub="Uses the FAQs on the left" checked={p.schema.faq} onChange={(v) => set({ schema: { ...p.schema, faq: v } })} />
                <Toggle id="sb" title="Include BreadcrumbList" sub="Home, Blog, Post" checked={p.schema.breadcrumb} onChange={(v) => set({ schema: { ...p.schema, breadcrumb: v } })} />
                <p className="help">Google now shows FAQ rich results only for a few sites, so treat FAQ markup as a clear signal for search and AI systems, not a promise of extra snippets.</p>
                <h3 style={{ marginTop: 12 }}>JSON-LD</h3><CopyBox text={ldJson(p, site, a.words)} rows={10} label="JSON-LD" />
                <h3 style={{ marginTop: 12 }}>Everything for the page head</h3><CopyBox text={headTags(p, site, a.words)} rows={10} label="Head tags" />
                <h3 style={{ marginTop: 12 }}>AI answer engines</h3>
                <ul className="chk">
                  <li><span className="m">Put the direct answer in the first paragraph. Use the TL;DR box.</span></li>
                  <li><span className="m">Use clear H2 and H3 questions and short paragraphs. AI tools quote them.</span></li>
                  <li><span className="m">Name the author and show dates. Cite sources.</span></li>
                  <li><span className="m">Allow AI search crawlers in robots.txt and add llms.txt (see SEO tools).</span></li>
                </ul>
              </>
            )}
            {tab === "preview" && (
              <>
                <b>Google, desktop</b>
                <div className="serp" style={{ margin: "6px 0 4px" }}>{serp(tt, dd)}</div>
                <div className="help">Title width about {Math.round(tw)} px of 600. {tw > 600 ? "Google will cut it off." : "Fits."} Google may rewrite titles and descriptions anyway.</div>
                <b style={{ display: "block", marginTop: 12 }}>Google, mobile</b>
                <div className="serp m" style={{ margin: "6px 0" }}>{serp(clip(t, 58) + (t.length > 58 ? "..." : ""), clip(dsc, 120) + (dsc.length > 120 ? "..." : ""))}</div>
                <b style={{ display: "block", marginTop: 12 }}>Link preview (Facebook, LinkedIn, WhatsApp, X)</b>
                <div className="og" style={{ marginTop: 6 }}>
                  <div className="im" style={{ position: "relative" }}>{img && /^https?:/.test(img) ? <img alt="" src={img} onError={(e) => e.currentTarget.remove()} /> : null}<span style={{ position: "absolute" }}>{p.title || "Post title"}</span></div>
                  <div className="tx"><small>{host(site.url) || u}</small><b>{p.ogTitle || p.metaTitle || p.title || "Post title"}</b><span>{clip(p.ogDesc || p.metaDesc || p.tldr, 110)}</span></div>
                </div>
              </>
            )}
            {tab === "publish" && (
              <>
                <label className="f" htmlFor="f_date">Publish date and time</label>
                <input type="datetime-local" id="f_date" value={(p.date || "").slice(0, 16)} onChange={(e) => set({ date: e.target.value })} />
                <p className="help">Set a future date and choose Scheduled to queue it. Your site must hide scheduled posts until that time.</p>
                <h3 style={{ marginTop: 12 }}>Sitemap entry</h3><CopyBox text={smx} rows={5} label="Sitemap entry" />
                <h3 style={{ marginTop: 12 }}>After you publish</h3>
                <ul className="chk">
                  <li><span className="ic pass">1</span><span>Deploy the post so the live URL works and shows the head tags.</span></li>
                  <li><span className="ic pass">2</span><span>Open Google Search Console, paste the URL in URL Inspection, then click Request indexing.</span></li>
                  <li><span className="ic pass">3</span><span>Ping Bing and others with IndexNow (SEO tools).</span></li>
                  <li><span className="ic pass">4</span><span>Share the link and link to it from 2 older posts.</span></li>
                </ul>
                <p className="help">Nobody can force Google to rank or index a page. These steps make discovery fast.</p>
                <p style={{ marginTop: 8 }}><button className="btn" onClick={() => copy(postUrl(site, p), "URL copied")}>Copy post URL</button></p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function escHtml(s: string) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Comma separated list that keeps what you type until you leave the field. */
function CsvInput({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [s, setS] = useState(value.join(", "));
  const parse = (x: string) => x.split(",").map((y) => y.trim()).filter(Boolean);
  return (
    <>
      <label className="f" htmlFor={id}>{label}<small>comma separated</small></label>
      <input id={id} value={s} onChange={(e) => { setS(e.target.value); onChange(parse(e.target.value)); }} onBlur={() => setS(parse(s).join(", "))} />
    </>
  );
}
