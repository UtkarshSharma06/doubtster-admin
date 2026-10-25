"use client";
import Link from "next/link";
import type { AuditEntry } from "@/lib/types";
import { Ago, Head, HBars, Kpi, LineChart, Note, Pill, series, useLabels } from "../ui";

export default function Overview({ blog, colleges, audit }: { blog: { pub: number; drafts: number; weak: number; noMeta: number }; colleges: [string, number, string][]; audit: AuditEntry[] }) {
  const lb = useLabels(30);
  const su = series(11, 30, 30, 1.6, 18), vi = series(13, 30, 12, 0.9, 10);
  const top: [string, number, number, string][] = [["how-to-solve-boat-and-stream-problems", 4820, 312, "6.4"], ["solve-3x-minus-7-equals-11", 3110, 198, "8.9"], ["photosynthesis-explained", 2240, 141, "11.2"], ["straight-line-depreciation", 1730, 96, "13.5"]];
  return (
    <>
      <Head title="Overview" sub="What is happening across the app and the blog."><Note>Sample numbers</Note></Head>
      <div className="grid g4">
        <Kpi label="Signups" value="1,284" sub={<span className="up">+18% vs last 30 days</span>} />
        <Kpi label="Videos generated" value="3,906" sub={<span className="up">+24% vs last 30 days</span>} />
        <Kpi label="Paid subscribers" value="212" sub={<span className="up">+9% vs last 30 days</span>} />
        <Kpi label="Blog clicks from search" value="12,540" sub={<span className="up">+31% vs last 30 days</span>} />
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Colleges <Pill c="p-blue">live</Pill></h3>
          <HBars list={colleges} />
          <p style={{ margin: "12px 0 0" }}><Link className="btn sm" href="/admin/colleges">Manage colleges</Link></p>
        </div>
        <div className="card">
          <h3>Latest admin activity</h3>
          {audit.length ? (
            <ul className="hist">{audit.map((a) => <li key={a.id}><b>{a.action}</b> {a.target}<span><Ago t={a.t} /> · {a.by}</span></li>)}</ul>
          ) : <p className="help">Nothing yet.</p>}
          <p style={{ margin: "12px 0 0" }}><Link className="btn sm" href="/admin/audit">Open audit log</Link></p>
        </div>
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card chart"><h3>Signups, last 30 days</h3><LineChart vals={su} labels={lb} color="var(--blue)" /></div>
        <div className="card chart"><h3>Videos generated, last 30 days</h3><LineChart vals={vi} labels={lb} color="var(--good)" /></div>
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Blog health <small style={{ fontWeight: 400, color: "var(--mute)" }}>(live from your posts)</small></h3>
          <div className="tw"><table><tbody>
            <tr><td>Published posts</td><td><b>{blog.pub}</b></td></tr>
            <tr><td>Drafts and scheduled</td><td><b>{blog.drafts}</b></td></tr>
            <tr><td>Posts with SEO score below 70</td><td><b className={blog.weak ? "dn" : "up"}>{blog.weak}</b></td></tr>
            <tr><td>Posts missing a meta description</td><td><b className={blog.noMeta ? "dn" : "up"}>{blog.noMeta}</b></td></tr>
          </tbody></table></div>
          <p style={{ margin: "12px 0 0" }}><Link className="btn primary sm" href="/admin/blog">Open blog posts</Link></p>
        </div>
        <div className="card">
          <h3>Top posts from Google <Pill c="p-mute">sample</Pill></h3>
          <div className="tw"><table>
            <thead><tr><th>Post</th><th>Impr.</th><th>Clicks</th><th>Avg pos.</th></tr></thead>
            <tbody>{top.map((t) => <tr key={t[0]}><td>/blog/{t[0]}</td><td>{t[1].toLocaleString("en-US")}</td><td>{t[2]}</td><td>{t[3]}</td></tr>)}</tbody>
          </table></div>
          <p className="help">Connect Google Search Console to replace this with your real data.</p>
        </div>
      </div>
    </>
  );
}
