import type { Post, Site, Data } from "./types";
import { BOTS } from "./bots";
import { clip, slugify, nowISO } from "./util";

/* ---------- markdown (escaped, safe to render) ---------- */
export const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const safeUrl = (u: string) => (/^(https?:|\/|#|mailto:)/i.test(u) ? u : "#");
function inline(t: string) {
  t = esc(t);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_m, a, s) => '<img alt="' + a + '" src="' + safeUrl(s) + '">');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, a, s) => '<a href="' + safeUrl(s) + '">' + a + "</a>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}
export function md(src: string) {
  const lines = String(src || "").split("\n"), out: string[] = [];
  let i = 0, list: string | null = null;
  const close = () => { if (list) { out.push("</" + list + ">"); list = null; } };
  while (i < lines.length) {
    const l = lines[i];
    let m: RegExpExecArray | null;
    if (/^```/.test(l)) { close(); const buf: string[] = []; i++; while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; } out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>"); i++; continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { close(); out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); }
    else if ((m = /^\s*[-*]\s+(.*)$/.exec(l))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); }
    else if ((m = /^\s*\d+\.\s+(.*)$/.exec(l))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); }
    else if (/^>\s?/.test(l)) { close(); out.push("<blockquote>" + inline(l.replace(/^>\s?/, "")) + "</blockquote>"); }
    else if (!l.trim()) close();
    else { close(); out.push("<p>" + inline(l) + "</p>"); }
    i++;
  }
  close();
  return out.join("\n");
}

/* ---------- analysis ---------- */
export function plain(m: string) {
  return String(m || "").replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "").replace(/^[\s>*+-]+/gm, "").replace(/[*_`|]/g, " ").replace(/\s+/g, " ").trim();
}
function syl(w: string) { w = w.toLowerCase().replace(/[^a-z]/g, ""); if (!w) return 0; let c = (w.match(/[aeiouy]+/g) || []).length; if (w.length > 2 && /e$/.test(w) && c > 1) c--; return Math.max(1, c); }
export function host(u: string) { try { return new URL(u).host; } catch { return ""; } }

export function analyze(p: Post, site: Site) {
  const txt = plain(p.body), words = txt ? txt.split(/\s+/).length : 0;
  const sents = txt.split(/[.!?]+\s+/).filter((s) => s.trim().split(/\s+/).length > 2).length || 1;
  let h1 = 0, h3 = 0, inC = false; const h2: string[] = [];
  String(p.body || "").split("\n").forEach((l) => { if (/^```/.test(l)) { inC = !inC; return; } if (inC) return; const m = /^(#{1,6})\s+(.*)$/.exec(l); if (m) { if (m[1].length === 1) h1++; else if (m[1].length === 2) h2.push(m[2]); else if (m[1].length === 3) h3++; } });
  const imgs: { alt: string; src: string }[] = []; const r = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g; let m: RegExpExecArray | null;
  while ((m = r.exec(p.body || ""))) imgs.push({ alt: m[1], src: m[2] });
  let inter = 0, ext = 0; const rl = /(^|[^!])\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, sh = host(site.url);
  while ((m = rl.exec(p.body || ""))) { const u = m[3]; if (/^\//.test(u) || (sh && host(u) === sh)) inter++; else if (/^https?:/.test(u)) ext++; }
  const paras = String(p.body || "").split(/\n{2,}/).filter((b) => b.trim() && !/^(#|```|[-*>|]|\d+\.)/.test(b.trim()));
  const longp = paras.filter((b) => plain(b).split(/\s+/).length > 120).length;
  const kw = (p.focusKw || "").toLowerCase().trim(), low = txt.toLowerCase();
  const kc = kw ? low.split(kw).length - 1 : 0, kwWords = kw ? kw.split(/\s+/).length : 1;
  const first = txt.split(/\s+/).slice(0, 100).join(" ").toLowerCase() + " " + String(p.tldr || "").toLowerCase();
  let flesch: number | null = null;
  if ((p.lang || "en") === "en" && words > 20) { const sy = txt.split(/\s+/).reduce((a, w) => a + syl(w), 0); flesch = Math.round(206.835 - 1.015 * (words / sents) - 84.6 * (sy / words)); }
  return { words, sents, h1, h2, h3, imgs, inter, ext, longp, kw, kc, dens: kw && words ? (kc * kwWords / words) * 100 : 0, first, flesch, avgSent: words / sents };
}

export interface Check { g: string; label: string; st: "pass" | "warn" | "fail"; msg: string; w: number }
export function checks(p: Post, site: Site): Check[] {
  const a = analyze(p, site), kw = a.kw, L: Check[] = [];
  const add = (g: string, label: string, st: Check["st"], msg?: string, w?: number) => L.push({ g, label, st, msg: msg || "", w: w || 1 });
  const mt = p.metaTitle || p.title || "", md_ = p.metaDesc || "";
  add("Keyword", "Focus keyword is set", kw ? "pass" : "fail", kw ? "" : "Choose the one phrase people would search for.", 2);
  add("Keyword", "Keyword is in the SEO title", kw && mt.toLowerCase().includes(kw) ? "pass" : "fail", "Put the focus keyword in the title, ideally near the start.", 2);
  add("Keyword", "Keyword is in the URL slug", kw && p.slug.includes(slugify(kw)) ? "pass" : kw && slugify(kw).split("-").every((w) => p.slug.includes(w)) ? "warn" : "fail", "Use the keyword words in the slug.", 1);
  add("Keyword", "Keyword is in the first 100 words", kw && a.first.includes(kw) ? "pass" : "fail", "Say the keyword early, in the summary or opening lines.", 2);
  add("Keyword", "Keyword is in the meta description", kw && md_.toLowerCase().includes(kw) ? "pass" : "fail", "Google bolds matching words in the snippet.", 1);
  add("Keyword", "Keyword is in a subheading (H2)", kw && a.h2.some((h) => h.toLowerCase().includes(kw)) ? "pass" : "warn", "Use it in at least one H2, in natural wording.", 1);
  add("Keyword", "Keyword density is natural", !kw ? "fail" : a.dens >= 0.4 && a.dens <= 2.5 ? "pass" : a.kc === 0 ? "fail" : "warn", kw ? "Now " + a.dens.toFixed(1) + "% (" + a.kc + " times). Aim for 0.5% to 2.5%." : "", 1);
  add("Meta", "SEO title length is 30 to 60 characters", mt.length >= 30 && mt.length <= 60 ? "pass" : mt.length > 0 ? "warn" : "fail", "Now " + mt.length + " characters.", 2);
  add("Meta", "Meta description is 120 to 160 characters", md_.length >= 120 && md_.length <= 160 ? "pass" : md_.length > 0 ? "warn" : "fail", "Now " + md_.length + " characters.", 2);
  add("Meta", "Slug is short, lowercase and uses hyphens", p.slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) && p.slug.length <= 75 ? "pass" : "fail", "Use only a to z, 0 to 9 and hyphens. Keep it under 75 characters.", 1);
  add("Meta", "Indexing is allowed", p.robots.index ? "pass" : "warn", "This post is set to noindex, so search engines will skip it.", 2);
  add("Meta", "Social image is set", p.ogImage || p.cover ? "pass" : "warn", "Add a 1200 x 630 image for link previews.", 1);
  add("Content", "Length is 800 words or more", a.words >= 800 ? "pass" : a.words >= 400 ? "warn" : "fail", "Now " + a.words + " words. In-depth posts of 1,200+ words tend to rank for more queries.", 2);
  add("Content", "Exactly one H1 (the title) and 3 or more H2", a.h1 === 0 && a.h2.length >= 3 ? "pass" : a.h1 > 0 ? "fail" : "warn", a.h1 > 0 ? 'Remove "# " headings from the body. The title is already the H1.' : "Now " + a.h2.length + " H2 headings.", 1);
  add("Content", "Paragraphs are short", a.longp === 0 ? "pass" : "warn", a.longp ? a.longp + " paragraph(s) are over 120 words. Split them." : "", 1);
  if ((p.lang || "en") === "en") add("Content", "Easy to read", a.flesch === null ? "warn" : a.flesch >= 60 ? "pass" : a.flesch >= 45 ? "warn" : "fail", a.flesch === null ? "Write more text to score readability." : "Flesch score " + a.flesch + " (60+ is easy). Average sentence " + a.avgSent.toFixed(0) + " words.", 1);
  const noAlt = a.imgs.filter((i) => !i.alt.trim()).length;
  add("Links and media", "Has at least one image with alt text", a.imgs.length && !noAlt ? "pass" : a.imgs.length ? "warn" : "fail", a.imgs.length ? (noAlt ? noAlt + " image(s) missing alt text." : "") : "Add a diagram or screenshot.", 1);
  add("Links and media", "Cover image has alt text", p.cover ? (p.coverAlt ? "pass" : "fail") : "warn", "Describe the image for screen readers and image search.", 1);
  add("Links and media", "Has 2 or more internal links", a.inter >= 2 ? "pass" : a.inter === 1 ? "warn" : "fail", "Now " + a.inter + ". Link to your other posts and to the app.", 1);
  add("Links and media", "Has an external source link", a.ext >= 1 || p.sources.length ? "pass" : "warn", "Link to a trusted source. It helps readers and AI answer engines trust the page.", 1);
  add("AI and trust", "Has an answer-first summary (TL;DR)", (p.tldr || "").split(/\s+/).filter(Boolean).length >= 25 ? "pass" : (p.tldr || "").trim() ? "warn" : "fail", "Write 40 to 60 words that answer the question directly. AI answers often quote this.", 2);
  add("AI and trust", "Has 3 or more FAQs", p.faqs.filter((f) => f.q && f.a).length >= 3 ? "pass" : "warn", "Real questions with short answers help search and AI summaries.", 1);
  add("AI and trust", "Has cited sources", p.sources.length ? "pass" : "warn", "List 1 to 3 sources at the end.", 1);
  add("AI and trust", "Named author and publish date", p.author && p.date ? "pass" : "warn", "Add an author and a date. Both are trust signals.", 1);
  return L;
}
export function score(p: Post, site: Site) {
  const L = checks(p, site); let t = 0, g = 0;
  L.forEach((c) => { t += c.w; g += c.w * (c.st === "pass" ? 1 : c.st === "warn" ? 0.5 : 0); });
  return Math.round((g / t) * 100);
}

/* ---------- head tags, schema and site files ---------- */
export const postUrl = (site: Site, p: Post) => site.url.replace(/\/$/, "") + "/blog/" + p.slug;
function strip<T>(o: T): T {
  return JSON.parse(JSON.stringify(o, (_k, v) => (v === "" || v === null || (Array.isArray(v) && !v.length) ? undefined : v)));
}
export function ldJson(p: Post, s: Site, words: number) {
  const url = postUrl(s, p), org = s.url + "/#org", g: Record<string, unknown>[] = [];
  g.push({ "@type": "Organization", "@id": org, name: s.name, url: s.url, logo: { "@type": "ImageObject", url: s.logo }, sameAs: s.sameAs.split(/\n+/).map((x) => x.trim()).filter(Boolean) });
  g.push({ "@type": "WebSite", "@id": s.url + "/#website", url: s.url, name: s.name, publisher: { "@id": org }, inLanguage: s.lang });
  if (p.schema.breadcrumb) g.push({ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: s.url }, { "@type": "ListItem", position: 2, name: "Blog", item: s.url + "/blog" }, { "@type": "ListItem", position: 3, name: p.title, item: url }] });
  const iso = (d: string) => (d ? new Date(d).toISOString() : undefined);
  g.push({ "@type": p.schema.type, "@id": url + "#article", headline: clip(p.title, 110), description: p.metaDesc || p.tldr, image: [p.ogImage || p.cover || s.ogImage],
    author: { "@type": "Person", name: p.author || s.author, url: s.authorUrl }, publisher: { "@id": org }, datePublished: iso(p.date), dateModified: iso(p.updated) || iso(p.date),
    mainEntityOfPage: { "@type": "WebPage", "@id": url }, keywords: [p.focusKw, ...p.secondaryKw].filter(Boolean).join(", "), articleSection: p.category, wordCount: words, inLanguage: p.lang,
    citation: p.sources.filter((x) => x.url).map((x) => ({ "@type": "CreativeWork", name: x.title, url: x.url })) });
  const fq = p.faqs.filter((f) => f.q && f.a);
  if (p.schema.faq && fq.length) g.push({ "@type": "FAQPage", mainEntity: fq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  return JSON.stringify(strip({ "@context": "https://schema.org", "@graph": g }), null, 2);
}
export function headTags(p: Post, s: Site, words: number) {
  const url = p.canonical || postUrl(s, p), t = p.metaTitle || p.title, d = p.metaDesc || clip(p.tldr, 155), img = p.ogImage || p.cover || s.ogImage;
  const r = [p.robots.index ? "index" : "noindex", p.robots.follow ? "follow" : "nofollow"]; if (p.robots.img) r.push("max-image-preview:large"); r.push("max-snippet:-1");
  const o = ["<title>" + esc(t) + "</title>", '<meta name="description" content="' + esc(d) + '">', '<link rel="canonical" href="' + esc(url) + '">', '<meta name="robots" content="' + r.join(", ") + '">'];
  (p.hreflang || []).filter((h) => h.lang && h.url).forEach((h) => o.push('<link rel="alternate" hreflang="' + esc(h.lang) + '" href="' + esc(h.url) + '">'));
  if ((p.hreflang || []).length) o.push('<link rel="alternate" hreflang="x-default" href="' + esc(url) + '">');
  o.push('<meta property="og:type" content="article">', '<meta property="og:site_name" content="' + esc(s.name) + '">', '<meta property="og:title" content="' + esc(p.ogTitle || t) + '">', '<meta property="og:description" content="' + esc(p.ogDesc || d) + '">', '<meta property="og:url" content="' + esc(url) + '">', '<meta property="og:image" content="' + esc(img) + '">', '<meta property="og:locale" content="' + esc(p.lang) + '">');
  if (p.date) o.push('<meta property="article:published_time" content="' + new Date(p.date).toISOString() + '">');
  if (p.updated) o.push('<meta property="article:modified_time" content="' + new Date(p.updated).toISOString() + '">');
  o.push('<meta property="article:author" content="' + esc(p.author || s.author) + '">'); if (p.category) o.push('<meta property="article:section" content="' + esc(p.category) + '">');
  p.tags.forEach((x) => o.push('<meta property="article:tag" content="' + esc(x) + '">'));
  o.push('<meta name="twitter:card" content="' + esc(p.twitterCard) + '">'); if (s.twitter) o.push('<meta name="twitter:site" content="' + esc(s.twitter) + '">');
  o.push('<meta name="twitter:title" content="' + esc(p.ogTitle || t) + '">', '<meta name="twitter:description" content="' + esc(p.ogDesc || d) + '">', '<meta name="twitter:image" content="' + esc(img) + '">');
  o.push('<script type="application/ld+json">\n' + ldJson(p, s, words) + "\n</script>");
  return o.join("\n");
}
export const published = (d: Pick<Data, "posts">) => d.posts.filter((p) => p.status === "published");
export function sitemapXml(d: Pick<Data, "posts" | "site">) {
  const s = d.site.url.replace(/\/$/, ""), x = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  [["/", "weekly", "1.0"], ["/pricing", "monthly", "0.7"], ["/blog", "daily", "0.8"]].forEach((u) => x.push("  <url><loc>" + s + u[0] + "</loc><changefreq>" + u[1] + "</changefreq><priority>" + u[2] + "</priority></url>"));
  published(d).forEach((p) => {
    if (!p.robots.index) return;
    x.push("  <url>", "    <loc>" + esc(p.canonical || postUrl(d.site, p)) + "</loc>", "    <lastmod>" + (p.updated || p.date || nowISO()).slice(0, 10) + "</lastmod>");
    (p.hreflang || []).filter((h) => h.lang && h.url).forEach((h) => x.push('    <xhtml:link rel="alternate" hreflang="' + esc(h.lang) + '" href="' + esc(h.url) + '"/>'));
    x.push("  </url>");
  });
  x.push("</urlset>");
  return x.join("\n");
}
export function robotsTxt(d: Pick<Data, "site" | "seo">) {
  const s = d.site.url.replace(/\/$/, ""), o = ["# robots.txt for " + d.site.name, "User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", ""];
  BOTS.forEach((b) => { if (b[0] === "Googlebot" || b[0] === "Bingbot") return; o.push("User-agent: " + b[0], d.seo.bots[b[0]] ? "Allow: /" : "Disallow: /", ""); });
  o.push("Sitemap: " + s + "/sitemap.xml");
  return o.join("\n");
}
export function llmsTxt(d: Pick<Data, "posts" | "site">) {
  const s = d.site, o = ["# " + s.name, "", "> " + s.name + " gives students step-by-step answers, notes and explanation videos in maths, science, finance, coding and more, in English, French, Spanish and Hindi.", "", "## Blog"];
  published(d).forEach((p) => o.push("- [" + p.title + "](" + postUrl(s, p) + "): " + clip(p.metaDesc || p.tldr, 140)));
  o.push("", "## Product", "- [" + s.name + " app](" + s.url + "): ask a question, get notes, flashcards and a video explanation");
  return o.join("\n");
}
export function rssXml(d: Pick<Data, "posts" | "site">) {
  const s = d.site, o = ['<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>', "<title>" + esc(s.name) + " Blog</title>", "<link>" + s.url + "/blog</link>", "<description>Study guides and worked examples from " + esc(s.name) + "</description>", "<language>" + s.lang + "</language>", '<atom:link href="' + s.url + '/rss.xml" rel="self" type="application/rss+xml"/>'];
  published(d).forEach((p) => o.push("<item><title>" + esc(p.title) + "</title><link>" + postUrl(s, p) + '</link><guid isPermaLink="true">' + postUrl(s, p) + "</guid><pubDate>" + new Date(p.date || p.updated).toUTCString() + "</pubDate><description>" + esc(clip(p.metaDesc || p.tldr, 200)) + "</description></item>"));
  o.push("</channel></rss>");
  return o.join("\n");
}
