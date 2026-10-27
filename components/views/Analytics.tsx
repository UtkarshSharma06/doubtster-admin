"use client";
import { useEffect, useMemo, useState } from "react";
import type { Flags, User } from "@/lib/types";
import { countBy, daysAgo, isPaid, money, mrrOf } from "@/lib/util";
import { TRACK } from "@/lib/track";
import { api, CopyBox, download, Head, HBars, Kpi, LineChart, Pill, Seg, useAction, useLabels } from "../ui";

export default function Analytics({ users: U, colleges, flags, manual, bulk }: { users: User[]; colleges: { id: string; name: string }[]; flags: Flags; manual: number; bulk: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [n, setN] = useState<7 | 30 | 90>(30);
  const [cost, setCost] = useState(String(flags.costPerVideoMin));
  const { run } = useAction();
  const lb = useLabels(n);

  const paidU = U.filter((u) => isPaid(u) && u.status === "active");
  const mrr = U.reduce((a, u) => a + mrrOf(u, flags), 0);
  const within = (d: number) => U.filter((u) => u.lastActive && daysAgo(u.lastActive) <= d).length;
  const d1 = within(1), d7 = within(7), d30 = within(30);

  const dau = useMemo(() => {
    const counts = new Array(n).fill(0);
    const now = Date.now();
    for (const u of U) {
      if (!u.lastActive) continue;
      const days = Math.floor((now - new Date(u.lastActive).getTime()) / 864e5);
      if (days >= 0 && days < n) {
        counts[n - 1 - days]++;
      }
    }
    return counts;
  }, [U, n]);

  const rev = useMemo(() => {
    const dailyRev = new Array(n).fill(0);
    const price = (Number(flags.priceMonthly) || 7.99) / 30;
    const now = Date.now();
    for (const u of paidU) {
      const days = Math.floor((now - new Date(u.joined || now).getTime()) / 864e5);
      for (let i = 0; i < n; i++) {
        if (n - 1 - i <= days) {
          dailyRev[i] += price;
        }
      }
    }
    return dailyRev.map((r) => Math.round(r));
  }, [paidU, flags.priceMonthly, n]);

  const totalUsers = U.length;
  const verifiedUsers = U.filter((u) => u.verified).length;
  const chatUsers = U.filter((u) => (u.chats || 0) > 0).length;
  const videoUsers = U.filter((u) => (u.videos || 0) > 0).length;
  const trialUsers = U.filter((u) => u.plan === "Pro trial").length;
  const paidCount = paidU.length;

  const F: [string, number][] = [
    ["Registered users", totalUsers],
    ["Verified email", verifiedUsers],
    ["Asked a question", chatUsers],
    ["Created explainer video", videoUsers],
    ["Active in trial", trialUsers],
    ["Paid subscriber", paidCount],
  ];

  const cohorts = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 6 }, (_, w) => {
      const cohortStart = now - (5 - w) * 7 * 864e5;
      const cohortEnd = cohortStart + 7 * 864e5;
      const cohortUsers = U.filter((u) => {
        const j = new Date(u.joined || 0).getTime();
        return j >= cohortStart && j < cohortEnd;
      });
      if (!cohortUsers.length) return [0];
      const row = [100];
      for (let j = 1; j < 6 - w; j++) {
        const activeAfterJWeeks = cohortUsers.filter((u) => {
          const la = new Date(u.lastActive || 0).getTime();
          return la >= cohortStart + j * 7 * 864e5;
        }).length;
        row.push(Math.round((activeAfterJWeeks / cohortUsers.length) * 100));
      }
      return row;
    });
  }, [U]);

  const cname = (id: string) => colleges.find((c) => c.id === id)?.name || "";
  const cr = { college: U.reduce((a, u) => a + (u.signupCredits || 0), 0), plan: paidU.length * (Number(flags.monthlyCredits) || 30), topup: 0 };
  const used = U.reduce((a, u) => a + (u.creditsUsed || 0), 0);

  const breakdown = (fn: (u: User) => string) =>
    countBy(U, fn).slice(0, 8).map(([key, count]) => {
      const p = U.filter((u) => (fn(u) || "Unknown") === key).filter(isPaid).length;
      return [key, count, " · " + Math.round((p / count) * 100) + "% paid"] as [string, number, string];
    });

  const vids = U.reduce((a, u) => a + (u.videos || 0), 0), cpm = Number(cost) || 0;
  const base = Date.now();

  return (
    <>
      <Head title="Analytics" sub="Growth, money, retention and who your students are.">
        <Seg label="Date range" value={n} onChange={setN} options={[[7, "7 days"], [30, "30 days"], [90, "90 days"]]} />
        <button className="btn" onClick={() => download("users/export")}>Export users CSV</button>
      </Head>
      <h2 className="sec">Money <Pill c="p-blue">live from users</Pill></h2>
      <div className="grid g4">
        <Kpi label="MRR" value={money(mrr)} sub={paidU.length + " paying users"} />
        <Kpi label="ARR" value={money(mrr * 12)} sub="MRR × 12" />
        <Kpi label="ARPU (paying)" value={money(paidU.length ? mrr / paidU.length : 0)} sub="per month" />
        <Kpi label="Trial to paid" value={(trialUsers ? Math.round((paidCount / trialUsers) * 100) : 0) + "%"} sub="trial conversion" />
      </div>
      <h2 className="sec">Engagement <Pill c="p-blue">live from users</Pill></h2>
      <div className="grid g4">
        <Kpi label="DAU" value={d1} sub="active in last 24 h" />
        <Kpi label="WAU" value={d7} sub="active in last 7 days" />
        <Kpi label="MAU" value={d30} sub="active in last 30 days" />
        <Kpi label="Stickiness" value={(d30 ? Math.round((d1 / d30) * 100) : 0) + "%"} sub="DAU / MAU" />
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card"><h3>User conversion funnel</h3>
          <p className="help" style={{ margin: "0 0 10px" }}><b style={{ color: "var(--ink)" }}>{totalUsers.toLocaleString("en-US")}</b> registered users across the platform.</p>
          <div className="fun">{F.slice(1).map(([l, v], i0) => {
            const i = i0 + 1;
            const prev = F[i - 1][1];
            return (
              <div className="fr" key={l}><span className="fl">{l}</span><span className="ft"><i style={{ width: totalUsers ? Math.max(2, (v / totalUsers) * 100).toFixed(1) + "%" : "0%" }} /></span>
                <span className="fv">{v.toLocaleString("en-US")}{i > 1 && prev > 0 && <small>{Math.round((v / prev) * 100)}% of previous</small>}</span></div>
            );
          })}</div>
        </div>
        <div className="card"><h3>Weekly retention</h3>
          <div className="tw"><table className="hm">
            <thead><tr><th>Cohort</th>{[0, 1, 2, 3, 4, 5].map((x) => <th key={x}>W{x}</th>)}</tr></thead>
            <tbody>{cohorts.map((row, w) => {
              const d = new Date(base - (5 - w) * 7 * 864e5);
              return (
                <tr key={w}><td suppressHydrationWarning>{mounted ? (d.getDate() + "/" + (d.getMonth() + 1)) : `Week ${w + 1}`}</td>
                  {[0, 1, 2, 3, 4, 5].map((j) => { const v = row[j]; return v == null ? <td key={j} /> : <td key={j} style={{ background: `color-mix(in srgb,var(--blue) ${Math.round(v * 0.85)}%,transparent)`, color: v > 55 ? "#fff" : "var(--ink)" }}>{v}%</td>; })}</tr>
              );
            })}</tbody>
          </table></div>
          <p className="help">Share of each week&apos;s signups who returned.</p>
        </div>
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card chart"><h3>Daily active users</h3><LineChart vals={dau} labels={lb} color="var(--blue)" /></div>
        <div className="card chart"><h3>Revenue per day, USD</h3><LineChart vals={rev} labels={lb} color="var(--good)" /></div>
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card"><h3>Credits issued vs used</h3>
          <HBars list={[["Plans (" + (flags.monthlyCredits || 30) + "/mo)", cr.plan], ["College signups", cr.college], ["College bonuses", bulk], ["Manual grants", manual], ["Used on videos", used]]} />
        </div>
        <div className="card"><h3>Video cost</h3>
          <div className="mini" style={{ margin: "0 0 10px" }}>
            <div><b>{vids}</b><span>videos made</span></div><div><b>{money(vids * 2.5 * cpm)}</b><span>est. cost</span></div><div><b>{money(paidU.length ? (vids * 2.5 * cpm) / paidU.length : 0)}</b><span>cost per payer</span></div>
          </div>
          <label className="f" htmlFor="acost">Your cost per video minute, USD</label>
          <input type="number" id="acost" step="0.001" min={0} value={cost} onChange={(e) => setCost(e.target.value)} onBlur={() => Number(cost) !== flags.costPerVideoMin && run(() => api("config", "PUT", { costPerVideoMin: Number(cost) || 0 }), "Cost saved")} />
          <p className="help">Assumes 2.5 minutes per video. Put in your real render plus model cost to see margin.</p>
        </div>
      </div>
      <h2 className="sec">Who your students are <Pill c="p-blue">live from users</Pill></h2>
      <div className="grid g2">
        <div className="card"><h3>Country</h3>{U.length ? <HBars list={breakdown((u) => u.country)} /> : <p className="help">No student activity recorded yet.</p>}</div>
        <div className="card"><h3>College</h3>{U.length ? <HBars list={breakdown((u) => cname(u.collegeId) || "No college")} /> : <p className="help">No student activity recorded yet.</p>}</div>
        <div className="card"><h3>Where they came from</h3>{U.length ? <HBars list={breakdown((u) => u.source)} /> : <p className="help">No student activity recorded yet.</p>}</div>
        <div className="card"><h3>Device</h3>{U.length ? <HBars list={breakdown((u) => u.device)} /> : <p className="help">No student activity recorded yet.</p>}</div>
        <div className="card"><h3>Language</h3>{U.length ? <HBars list={breakdown((u) => (u.lang || "").toUpperCase())} /> : <p className="help">No student activity recorded yet.</p>}</div>
        <div className="card"><h3>Main subject</h3>{U.length ? <HBars list={breakdown((u) => u.subject)} /> : <p className="help">No student activity recorded yet.</p>}</div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Tracking plan for the app</h3>
        <p className="help" style={{ margin: "0 0 8px" }}>Telemetry events sent from server to your analytics provider.</p>
        <CopyBox text={JSON.stringify(TRACK, null, 2)} rows={12} label="Tracking plan" />
      </div>
    </>
  );
}
