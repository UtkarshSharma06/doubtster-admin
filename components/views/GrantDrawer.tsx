"use client";
import { useState } from "react";
import type { Payment, Plan, User } from "@/lib/types";
import { fmt } from "@/lib/util";
import { api, Drawer, useAction } from "../ui";

const REASONS = ["Payment verification failed", "Payment provider outage", "Support goodwill", "Account bug on our side", "Other"];
const defDays = (pl: Plan, trialDays: number) => (pl === "Pro annual" ? 365 : pl === "Pro trial" ? trialDays || 7 : 30);
function newExpiry(u: User, plan: Plan, days: number) {
  const now = new Date();
  let base = now;
  if (u.plan === plan && u.expires && new Date(u.expires) > now) base = new Date(u.expires);
  return new Date(base.getTime() + days * 864e5).toISOString().slice(0, 10);
}

export default function GrantDrawer({ users, pay, userId, trialDays, onClose }: { users: Pick<User, "id" | "name" | "plan" | "credits" | "expires">[]; pay?: Payment | null; userId?: string; trialDays: number; onClose: () => void }) {
  const [uid, setUid] = useState(userId || pay?.userId || users[0]?.id);
  const [plan, setPlan] = useState<Plan>(pay ? pay.plan : "Pro monthly");
  const [days, setDays] = useState(String(defDays(plan, trialDays)));
  const [credits, setCredits] = useState(pay ? "5" : "0");
  const [reason, setReason] = useState(pay ? REASONS[0] : REASONS[2]);
  const [note, setNote] = useState("");
  const [ref, setRef] = useState(pay?.ref || "");
  const [err, setErr] = useState("");
  const { run, busy } = useAction();
  const u = users.find((x) => x.id === uid) as User | undefined;
  const dn = Math.max(0, Math.floor(Number(days) || 0)), cn = Math.max(0, Math.floor(Number(credits) || 0));

  async function apply() {
    setErr("");
    try {
      await api("grants", "POST", { userId: uid, plan, days: dn, credits: cn, reason, note, ref, paymentId: pay?.id });
    } catch (e) { setErr((e as Error).message); return; }
    await run(async () => null, "Granted to " + (u?.name || "user"));
    onClose();
  }

  return (
    <Drawer title="Manual grant" onClose={onClose}>
      <p className="help">{pay ? <>For payment <b>{pay.ref}</b> ({pay.amount} {pay.cur}, {pay.error})</> : "Give a plan or credits without a payment."}</p>
      <label className="f" htmlFor="gu">User</label>
      <select id="gu" value={uid} disabled={!!pay} onChange={(e) => setUid(e.target.value)}>
        {users.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.plan})</option>)}
      </select>
      <div className="row2">
        <div><label className="f" htmlFor="gp">Plan</label>
          <select id="gp" value={plan} onChange={(e) => { const p = e.target.value as Plan; setPlan(p); setDays(String(defDays(p, trialDays))); }}>
            {(["Pro monthly", "Pro annual", "Pro trial"] as Plan[]).map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><label className="f" htmlFor="gd">Days of access</label><input type="number" id="gd" min={0} max={730} value={days} onChange={(e) => setDays(e.target.value)} /></div>
      </div>
      <label className="f" htmlFor="gc">Video credits to add</label><input type="number" id="gc" min={0} max={500} value={credits} onChange={(e) => setCredits(e.target.value)} />
      <label className="f" htmlFor="gr">Reason</label>
      <select id="gr" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((x) => <option key={x}>{x}</option>)}</select>
      <label className="f" htmlFor="gn">Note<small>{reason === "Other" ? "required" : "optional"}</small></label>
      <textarea id="gn" rows={2} placeholder="What happened and what you checked" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="f" htmlFor="gf">Reference<small>payment ID or ticket</small></label><input type="text" id="gf" value={ref} onChange={(e) => setRef(e.target.value)} />
      {u && <div className="gprev"><b>{u.name}</b> will {dn ? <>have <b>{plan}</b> until <b>{fmt(newExpiry(u, plan, dn))}</b></> : "keep the current plan"}{cn ? <> and get <b>+{cn} credits</b> (total {u.credits + cn})</> : null}.</div>}
      {err && <p className="help dn" role="alert">{err}</p>}
      <p style={{ marginTop: 14, display: "flex", gap: 8 }}><button className="btn primary" disabled={busy} onClick={apply}>Apply grant</button><button className="btn" onClick={onClose}>Cancel</button></p>
      <p className="help">Logged with the date, reason and who did it. You can revoke it later.</p>
    </Drawer>
  );
}
