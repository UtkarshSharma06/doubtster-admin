"use client";
import { useEffect, useState } from "react";
import type { Site } from "@/lib/types";
import { api, Head, Pill, useAction, useArm, useCopy } from "../ui";

export default function Settings({ site, isSuper }: { site: Site; isSuper: boolean }) {
  const [s, setS] = useState(site);
  const [dirty, setDirty] = useState(false);
  const [json, setJson] = useState("");
  const { run, busy } = useAction();
  const arm = useArm();
  const copy = useCopy();
  useEffect(() => { setS(site); setDirty(false); }, [site]);
  const F = (k: keyof Site, label: string, o: { hint?: string; area?: boolean; rows?: number; type?: string } = {}) => (
    <>
      <label className="f" htmlFor={"s_" + k}>{label}{o.hint && <small>{o.hint}</small>}</label>
      {o.area ? <textarea id={"s_" + k} rows={o.rows || 3} value={s[k]} onChange={(e) => { setS({ ...s, [k]: e.target.value }); setDirty(true); }} />
        : <input type={o.type || "text"} id={"s_" + k} value={s[k]} onChange={(e) => { setS({ ...s, [k]: e.target.value }); setDirty(true); }} />}
    </>
  );
  async function exportAll() {
    const d = await api("data", "GET");
    setJson(JSON.stringify(d, null, 2));
  }
  return (
    <>
      <Head title="Settings" sub="Site details used in titles, schema and the files in SEO tools.">
        {dirty && <Pill c="p-warn">Unsaved</Pill>}
        <button className="btn primary" disabled={!dirty || busy} onClick={() => run(() => api("site", "PUT", s), "Settings saved")}>Save settings</button>
      </Head>
      <div className="grid g2">
        <div className="card"><h3>Site</h3>{F("name", "Site name")}{F("url", "Site address", { type: "url", hint: "your live domain" })}{F("logo", "Logo URL", { type: "url" })}{F("ogImage", "Default social image URL", { type: "url", hint: "1200 x 630" })}{F("lang", "Default language")}</div>
        <div className="card"><h3>Author and brand</h3>{F("author", "Default author")}{F("authorUrl", "Author page URL", { type: "url" })}{F("authorBio", "Author bio", { area: true })}{F("twitter", "X / Twitter handle")}{F("sameAs", "Profile links", { area: true, rows: 4, hint: "one per line" })}</div>
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card"><h3>Verification and analytics</h3>{F("gsc", "Google Search Console meta code")}{F("bing", "Bing Webmaster meta code")}{F("ga", "Google Analytics 4 ID", { hint: "G-XXXXXXX" })}<p className="help">Verification codes go in a meta tag on your home page head.</p></div>
        {isSuper ? <div className="card"><h3>Backup and move data</h3>
          <div className="out"><textarea className="code" rows={9} aria-label="All data as JSON" value={json} onChange={(e) => setJson(e.target.value)} placeholder="Click Export to load all data here, or paste a backup to import." />{json && <button className="btn sm" onClick={() => copy(json, "Data copied")}>Copy</button>}</div>
          <p style={{ margin: "10px 0 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={exportAll}>Export</button>
            <button className="btn primary" disabled={!json.trim() || busy} onClick={() => { let o; try { o = JSON.parse(json); } catch { o = null; } if (!o) return run(async () => { throw new Error("That is not valid JSON"); }); run(() => api("data", "POST", o), "Imported"); }}>Import from box</button>
            <button className="btn danger" onClick={() => arm.hit("reset", () => run(() => api("data/reset"), "Reset to sample data"))}>{arm.armed === "reset" ? "Click again to reset" : "Reset sample data"}</button>
          </p>
          <p className="help">Import replaces everything except the audit log and admin accounts. Reset brings back the sample data. Super admins only.</p>
        </div> : <div className="card"><h3>Backup and move data</h3><p className="help">Only a super admin can export, import or reset data.</p></div>}
      </div>
      <div className="card" style={{ marginTop: 14 }}><h3>Before you use this for real</h3>
        <ul className="chk">
          <li><span className="m">Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SECRET and HOOK_SECRET in your host&apos;s environment. Never commit them.</span></li>
          <li><span className="m">Swap lib/store.ts for your real database. The JSON file store is for local use and does not persist on Vercel.</span></li>
          <li><span className="m">Call /api/hooks/signup from your signup handler and /api/hooks/email-verified from email verification, so college credits work for real students.</span></li>
          <li><span className="m">Run /api/hooks/expire-credits once a day with a cron job.</span></li>
          <li><span className="m">Numbers marked sample on Overview and Analytics are placeholders until you connect real analytics.</span></li>
        </ul>
      </div>
    </>
  );
}
