"use client";
import { useState } from "react";
import type { Grant, Payment, User } from "@/lib/types";
import { fmt } from "@/lib/util";
import { api, Head, Kpi, Note, Pill, useAction, useArm } from "../ui";
import GrantDrawer from "./GrantDrawer";

type U = Pick<User, "id" | "name" | "plan" | "credits" | "expires">;

export default function Payments({ payments: P, grants: G, users, trialDays }: { payments: Payment[]; grants: Grant[]; users: U[]; trialDays: number }) {
  const [drawer, setDrawer] = useState<{ pay?: Payment } | null>(null);
  const { run } = useAction();
  const arm = useArm();
  const uname = (id: string) => users.find((u) => u.id === id)?.name || "Unknown";
  const st: Record<string, string> = { failed: "p-bad", resolved: "p-good", rejected: "p-mute" };
  const open = P.filter((p) => p.status === "failed").length;
  return (
    <>
      <Head title="Payments" sub="Fix failed payment verifications by giving a plan or credits by hand. Every grant is logged.">
        <button className="btn primary" onClick={() => setDrawer({})}>Manual grant</button>
      </Head>
      <div className="grid g4">
        <Kpi label="Need action" value={open} cls={open ? "dn" : ""} />
        <Kpi label="Resolved" value={P.filter((p) => p.status === "resolved").length} />
        <Kpi label="Active manual grants" value={G.filter((g) => g.status === "active").length} />
        <Kpi label="Credits given by hand" value={G.filter((g) => g.status === "active").reduce((a, g) => a + g.credits, 0)} />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Payment verifications</h3>
        <div className="tw"><table>
          <thead><tr><th>Date</th><th>User</th><th>Plan</th><th>Amount</th><th>Provider reference</th><th>What went wrong</th><th>Status</th><th></th></tr></thead>
          <tbody>{P.map((p) => (
            <tr key={p.id}>
              <td>{fmt(p.date)}</td><td><b>{uname(p.userId)}</b></td><td>{p.plan}</td><td>{p.amount} {p.cur}</td>
              <td><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{p.method} · {p.ref}</span></td>
              <td style={{ minWidth: 220 }}>{p.error}{p.note && <><br /><span style={{ color: "var(--mute)" }}>Note: {p.note}</span></>}</td>
              <td><Pill c={st[p.status]}>{p.status}</Pill></td>
              <td style={{ whiteSpace: "nowrap" }}>{p.status === "failed" && <>
                <button className="btn sm primary" onClick={() => setDrawer({ pay: p })}>Grant access</button>{" "}
                <button className="btn sm danger" onClick={() => arm.hit("r" + p.id, () => run(() => api("payments/" + p.id + "/reject"), "Payment rejected"))}>{arm.armed === "r" + p.id ? "Sure?" : "Reject"}</button>
              </>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="help">Per your refund policy: refunds only for payment verification failures and bugs on your side. Grant access first so the student is not blocked, then fix or refund the payment at your provider.</p>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Manual grants log</h3>
        <div className="tw"><table>
          <thead><tr><th>Date</th><th>User</th><th>Gave</th><th>Reason</th><th>Reference</th><th>By</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {G.map((g) => (
              <tr key={g.id}>
                <td>{fmt(g.date)}</td><td><b>{uname(g.userId)}</b></td>
                <td>{g.days ? g.plan + " for " + g.days + " days" : "Credits only"}{g.credits ? <><br /><span style={{ color: "var(--mute)" }}>+{g.credits} credits</span></> : null}</td>
                <td>{g.reason}{g.note && <><br /><span style={{ color: "var(--mute)" }}>{g.note}</span></>}</td>
                <td>{g.ref || "-"}</td><td>{g.by}</td>
                <td><Pill c={g.status === "active" ? "p-good" : "p-mute"}>{g.status}</Pill></td>
                <td>{g.status === "active" && <button className="btn sm danger" onClick={() => arm.hit("g" + g.id, () => run(() => api("grants/" + g.id + "/revoke"), "Grant revoked"))}>{arm.armed === "g" + g.id ? "Sure?" : "Revoke"}</button>}</td>
              </tr>
            ))}
            {!G.length && <tr><td colSpan={8} style={{ color: "var(--mute)" }}>No manual grants yet.</td></tr>}
          </tbody>
        </table></div>
      </div>
      {drawer && <GrantDrawer users={users} pay={drawer.pay} trialDays={trialDays} onClose={() => setDrawer(null)} />}
    </>
  );
}
