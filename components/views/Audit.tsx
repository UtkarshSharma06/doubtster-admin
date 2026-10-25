"use client";
import { useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { Ago, download, Head, Pill } from "../ui";

const TYPES = ["all", "security", "admins", "controls", "promo", "college", "signup", "credits", "user", "payment", "content", "system"];

export default function Audit({ audit }: { audit: AuditEntry[] }) {
  const [q, setQ] = useState("");
  const [t, setT] = useState("all");
  const L = audit.filter((a) => (t === "all" || a.type === t) && (!q || (a.action + " " + a.target + " " + a.detail + " " + a.by).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <Head title="Audit log" sub="Every admin change, with who did it and when. Entries cannot be edited or deleted.">
        <button className="btn" id="auexp" onClick={() => download("audit/export")}>Export CSV</button>
      </Head>
      <div className="card">
        <div className="row2" style={{ marginBottom: 10 }}>
          <input type="search" placeholder="Search action, target, detail or person" aria-label="Search audit log" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Type filter" value={t} onChange={(e) => setT(e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{x === "all" ? "All types" : x}</option>)}</select>
        </div>
        <div className="tw"><table>
          <thead><tr><th>When</th><th>Type</th><th>Action</th><th>Target</th><th>Detail</th><th>By</th></tr></thead>
          <tbody id="ab">
            {L.slice(0, 300).map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap" }} title={a.t}><Ago t={a.t} /></td>
                <td><Pill c={a.type === "security" || a.type === "admins" ? "p-warn" : "p-blue"}>{a.type}</Pill></td><td><b>{a.action}</b></td>
                <td><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{a.target}</span></td>
                <td style={{ minWidth: 200 }}>{a.detail}</td><td>{a.by}{a.ip && <><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>{a.ip}</span></>}</td>
              </tr>
            ))}
            {!L.length && <tr><td colSpan={6} style={{ color: "var(--mute)" }}>Nothing here yet.</td></tr>}
          </tbody>
        </table></div>
        <p className="help">Each row is written in the same save as the change itself. Showing the latest {Math.min(300, L.length)} of {L.length}. Export has everything.</p>
      </div>
    </>
  );
}
