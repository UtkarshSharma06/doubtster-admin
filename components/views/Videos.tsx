"use client";
import type { Job } from "@/lib/types";
import { api, Head, Kpi, Note, Pill, useAction } from "../ui";

export default function Videos({ jobs }: { jobs: Job[] }) {
  const { run, busy } = useAction();
  const st: Record<string, string> = { done: "p-good", rendering: "p-blue", queued: "p-mute", failed: "p-bad" };
  const vf: Record<string, string> = { verified: "p-good", "needs review": "p-warn", failed: "p-bad", pending: "p-mute" };
  const q = jobs.filter((j) => j.status === "queued" || j.status === "rendering").length;
  const done = jobs.filter((j) => j.status === "done"), ok = done.filter((j) => Math.abs(j.actual - j.target) / j.target <= 0.03).length;
  return (
    <>
      <Head title="Videos" sub="Watch generation jobs, retry failures and check length consistency." />
      <div className="grid g4">
        <Kpi label="In queue or rendering" value={q} />
        <Kpi label="Finished" value={done.length} />
        <Kpi label="Within 3% of requested length" value={(done.length ? Math.round((ok / done.length) * 100) : 0) + "%"} />
        <Kpi label="Failed" value={jobs.filter((j) => j.status === "failed").length} />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="tw"><table>
          <thead><tr><th>Question</th><th>Lang</th><th>Subject</th><th>Requested</th><th>Actual</th><th>Answer check</th><th>Status</th><th></th></tr></thead>
          <tbody>{jobs.map((j) => {
            const off = j.actual && Math.abs(j.actual - j.target) / j.target > 0.03;
            return (
              <tr key={j.id}>
                <td>{j.q}</td><td>{j.lang.toUpperCase()}</td><td>{j.domain}</td><td>{j.target} s</td>
                <td>{j.actual ? <span className={off ? "dn" : ""}>{j.actual} s</span> : "-"}</td>
                <td><Pill c={vf[j.verify]}>{j.verify}</Pill></td><td><Pill c={st[j.status]}>{j.status}</Pill></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {j.status === "failed" && <button className="btn sm" disabled={busy} onClick={() => run(() => api("jobs/" + j.id, "POST", { action: "retry" }), "Job queued again")}>Retry</button>}
                  {(j.status === "queued" || j.status === "rendering") && <button className="btn sm danger" disabled={busy} onClick={() => run(() => api("jobs/" + j.id, "POST", { action: "cancel" }), "Job cancelled")}>Cancel</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="help">Connect the jobs list to your video engine&apos;s queue to see real jobs. Retry and Cancel already go through the server and the audit log.</p>
      </div>
    </>
  );
}
