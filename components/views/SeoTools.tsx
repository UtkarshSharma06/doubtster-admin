"use client";
import { useEffect, useState } from "react";
import type { Data, Post, Site } from "@/lib/types";
import { BOTS } from "@/lib/bots";
import { host, llmsTxt, postUrl, robotsTxt, rssXml, sitemapXml } from "@/lib/seo";
import { api, CopyBox, Head, Tabs, Toggle, useAction } from "../ui";

type T = "sitemap" | "robots" | "llms" | "rss" | "indexnow" | "redirects" | "checklist";

export default function SeoTools({ posts, site, seo, strong }: { posts: Post[]; site: Site; seo: Data["seo"]; strong: number }) {
  const [tab, setTab] = useState<T>("sitemap");
  const [bots, setBots] = useState(seo.bots);
  const [red, setRed] = useState(seo.redirects);
  const [key, setKey] = useState(site.indexnow);
  const { run, busy } = useAction();
  useEffect(() => { setBots(seo.bots); setRed(seo.redirects); }, [seo]);
  const d = { posts, site, seo: { ...seo, bots } };
  const urls = posts.map((p) => postUrl(site, p));

  return (
    <>
      <Head title="SEO tools" sub="Site-wide files and settings. Copy each file into your site. Files update as you publish posts." />
      <div className="card">
        <Tabs value={tab} onChange={setTab} options={[["sitemap", "sitemap.xml"], ["robots", "robots.txt"], ["llms", "llms.txt"], ["rss", "RSS feed"], ["indexnow", "IndexNow"], ["redirects", "Redirects"], ["checklist", "Setup checklist"]]} />
        {tab === "sitemap" && <><p className="help" style={{ marginTop: 0 }}>Place at <code>/sitemap.xml</code>. Includes published, indexable posts only, with translations when set. In Next.js, generate it from <code>app/sitemap.ts</code> using the same data.</p><CopyBox text={sitemapXml(d)} rows={16} /><p className="help">Then submit the sitemap URL in Google Search Console and Bing Webmaster Tools.</p></>}
        {tab === "robots" && (
          <>
            <p className="help" style={{ marginTop: 0 }}>Place at <code>/robots.txt</code>. Allowing AI search crawlers lets answer engines cite you. Training crawlers are your choice. Changes save right away.</p>
            <div className="grid g2" style={{ gap: "0 24px" }}>
              {BOTS.map((b) => <Toggle key={b[0]} id={"bot_" + b[0]} title={b[0]} sub={b[1] + (b[3] ? " (always on)" : "")} checked={!!bots[b[0]]} disabled={b[3]}
                onChange={(v) => { const nb = { ...bots, [b[0]]: v }; setBots(nb); run(() => api("seo", "PUT", { bots: nb }), b[0] + (v ? " allowed" : " blocked")); }} />)}
            </div>
            <div style={{ marginTop: 12 }}><CopyBox text={robotsTxt(d)} rows={14} /></div>
            <p className="help">robots.txt is a request, not a lock. Well-behaved crawlers follow it.</p>
          </>
        )}
        {tab === "llms" && <><p className="help" style={{ marginTop: 0 }}>Place at <code>/llms.txt</code>. A proposed convention that gives AI tools a clean summary of your site. Support by AI products is not confirmed, so treat it as a cheap extra.</p><CopyBox text={llmsTxt(d)} rows={14} /></>}
        {tab === "rss" && <><p className="help" style={{ marginTop: 0 }}>Place at <code>/rss.xml</code> and add <code>&lt;link rel=&quot;alternate&quot; type=&quot;application/rss+xml&quot; href=&quot;/rss.xml&quot;&gt;</code> to your head.</p><CopyBox text={rssXml(d)} rows={14} /></>}
        {tab === "indexnow" && (
          <>
            <p className="help" style={{ marginTop: 0 }}>IndexNow tells Bing, Yandex, Naver and others about new or changed URLs right away. Google does not use it.</p>
            <label className="f" htmlFor="ink">Your key</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" id="ink" value={key} placeholder="Generate a key" onChange={(e) => setKey(e.target.value.trim())} onBlur={() => key !== site.indexnow && run(() => api("site", "PUT", { indexnow: key }), "Key saved")} />
              <button className="btn" disabled={busy} onClick={() => { const a = new Uint8Array(16); crypto.getRandomValues(a); const k = Array.from(a, (x) => x.toString(16).padStart(2, "0")).join(""); setKey(k); run(() => api("site", "PUT", { indexnow: k }), "Key saved"); }}>Generate</button>
            </div>
            <p className="help">Host a text file at <code>/{key || "KEY"}.txt</code> that contains only the key.</p>
            <h3 style={{ marginTop: 14 }}>Submit request body</h3>
            <CopyBox rows={10} text={JSON.stringify({ host: host(site.url), key: key || "KEY", keyLocation: site.url + "/" + (key || "KEY") + ".txt", urlList: urls }, null, 2)} />
            <p className="help">POST this JSON to <code>https://api.indexnow.org/indexnow</code> from your server when a post is published.</p>
          </>
        )}
        {tab === "redirects" && (
          <>
            <p className="help" style={{ marginTop: 0 }}>Use 301 redirects when you change a slug so links and rankings carry over. Live posts add these automatically.</p>
            {red.map((r, i) => (
              <div className="row2" key={i} style={{ marginBottom: 6 }}>
                <input type="text" aria-label="From" placeholder="/old-path" value={r.from} onChange={(e) => setRed(red.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="text" aria-label="To" placeholder="/new-path" value={r.to} onChange={(e) => setRed(red.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                  <button className="btn sm danger" aria-label="Remove redirect" onClick={() => setRed(red.filter((_, j) => j !== i))}>x</button>
                </div>
              </div>
            ))}
            <p style={{ display: "flex", gap: 8 }}>
              <button className="btn sm" onClick={() => setRed([...red, { from: "", to: "" }])}>Add redirect</button>
              <button className="btn sm primary" disabled={busy || JSON.stringify(red) === JSON.stringify(seo.redirects)} onClick={() => run(() => api("seo", "PUT", { redirects: red.filter((r) => r.from && r.to) }), "Redirects saved")}>Save redirects</button>
            </p>
            <h3 style={{ marginTop: 14 }}>Next.js next.config.js</h3>
            <CopyBox rows={8} text={"async redirects() {\n  return [\n" + red.filter((r) => r.from && r.to).map((r) => "    { source: '" + r.from + "', destination: '" + r.to + "', permanent: true },").join("\n") + "\n  ];\n}"} />
          </>
        )}
        {tab === "checklist" && (
          <>
            <ul className="chk">
              {([
                ["Real site address set in Settings", /doubtster\.com/.test(site.url) ? "pass" : "warn", "Set your live domain in Settings."],
                ["Google Search Console verified", site.gsc ? "pass" : "warn", "Add the verification code in Settings, then verify the property."],
                ["Bing Webmaster Tools verified", site.bing ? "pass" : "warn", "Import from Search Console in one click, or add the code."],
                ["Sitemap submitted", "warn", "Submit /sitemap.xml in both consoles."],
                ["HTTPS everywhere and one canonical host (www or not)", "warn", "Redirect the other version with a 301."],
                ["Fast pages and good mobile layout", "warn", "Check Core Web Vitals in Search Console after a few weeks."],
                ["Social profiles linked in schema", site.sameAs.trim() ? "pass" : "warn", "Fill the profile list in Settings."],
                ["Analytics added", site.ga ? "pass" : "warn", "Add a GA4 ID in Settings."],
                ["At least 5 published posts with a score of 80 or more", strong >= 5 ? "pass" : "warn", "You have " + strong + "."],
              ] as [string, string, string][]).map(([l, st, m]) => (
                <li key={l}><span className={"ic " + st}>{st === "pass" ? "✓" : "!"}</span><span>{l}{st !== "pass" && <><br /><span className="m">{m}</span></>}</span></li>
              ))}
            </ul>
            <p className="help">Rankings take weeks and depend on content quality and competition. This list covers the technical basics.</p>
          </>
        )}
      </div>
    </>
  );
}
