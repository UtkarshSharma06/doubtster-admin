"use client";
import Link from "next/link";
import type { AuditEntry, Post } from "@/lib/types";
import { Ago, Head, HBars, Kpi, LineChart, Pill, useLabels } from "../ui";

export default function Overview({
  stats,
  blog,
  posts,
  colleges,
  audit,
}: {
  stats: { signups: number; videos: number; paid: number };
  blog: { pub: number; drafts: number; weak: number; noMeta: number };
  posts: Post[];
  colleges: [string, number, string][];
  audit: AuditEntry[];
}) {
  const lb = useLabels(30);
  const su = new Array(30).fill(0);
  if (stats.signups > 0) {
    su[29] = stats.signups;
  }
  const vi = new Array(30).fill(0);
  if (stats.videos > 0) {
    vi[29] = stats.videos;
  }

  return (
    <>
      <Head title="Overview" sub="Real-time telemetry and activity across Doubtster." />
      <div className="grid g4">
        <Kpi label="Signups" value={stats.signups.toLocaleString("en-US")} sub="Total registered students" />
        <Kpi label="Videos generated" value={stats.videos.toLocaleString("en-US")} sub="Live video explainer jobs" />
        <Kpi label="Paid subscribers" value={stats.paid.toLocaleString("en-US")} sub="Active Pro members" />
        <Kpi label="Published articles" value={blog.pub.toLocaleString("en-US")} sub="Active blog posts" />
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Colleges <Pill c="p-blue">live</Pill></h3>
          {colleges.length ? (
            <HBars list={colleges} />
          ) : (
            <p className="help">No college programs configured yet.</p>
          )}
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
          <h3>Top posts</h3>
          {posts.length ? (
            <div className="tw"><table>
              <thead><tr><th>Post</th><th>Category</th><th>Status</th></tr></thead>
              <tbody>{posts.slice(0, 5).map((t) => <tr key={t.id}><td><b>{t.title}</b><br/><span style={{ fontSize: 12, color: "var(--mute)" }}>/blog/{t.slug}</span></td><td>{t.category || "General"}</td><td><Pill c={t.status === "published" ? "p-good" : "p-mute"}>{t.status}</Pill></td></tr>)}</tbody>
            </table></div>
          ) : (
            <p className="help">No published articles yet. Create articles in the Blog section.</p>
          )}
        </div>
      </div>
    </>
  );
}
