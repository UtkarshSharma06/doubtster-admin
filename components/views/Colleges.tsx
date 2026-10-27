"use client";
import { useEffect, useMemo, useState } from "react";
import type { AuditEntry, College } from "@/lib/types";
import type { CStats } from "@/lib/util";
import { money } from "@/lib/util";
import type { SignupResult } from "@/lib/college";
import { Ago, api, download, Drawer, Head, HBars, Kpi, Pill, Seg, Switch, Toggle, useAction, useArm } from "../ui";

type Row = College & { stats: CStats };
type MiniUser = { id: string; name: string; email: string; plan: string; credits: number; collegeId: string };

export default function Colleges({ colleges, users, history }: { colleges: Row[]; users: MiniUser[]; history: AuditEntry[] }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | "active" | "paused">("all");
  const [open, setOpen] = useState<string | null>(null); // college id, or "new"
  const { run } = useAction();
  const sum = (k: keyof CStats) => colleges.reduce((a, c) => a + c.stats[k], 0);
  const su = sum("signups"), pd = sum("paid");
  const list = colleges.filter((c) => (st === "all" || (st === "active") === c.active) && (!q || (c.name + " " + c.domain + " " + c.code + " " + c.country).toLowerCase().includes(q.toLowerCase())));
  const chart = colleges.filter((c) => c.stats.credits || c.stats.used).sort((a, b) => b.stats.credits - a.stats.credits).map((c) => [c.name, c.stats.credits, " / " + c.stats.used + " used"] as [string, number, string]);
  const current = open && open !== "new" ? colleges.find((c) => c.id === open) || null : null;

  return (
    <>
      <Head title="Colleges and domains" sub="Students who sign up with a matching college email get the credits you set here. Pause or reactivate any domain at any time.">
        <button className="btn" onClick={() => download("colleges/export")}>Export CSV</button>
        <button className="btn primary" onClick={() => setOpen("new")}>Add college</button>
      </Head>
      <div className="grid g4">
        <Kpi label="Active domains" value={<>{colleges.filter((c) => c.active).length} <small style={{ fontSize: 14, color: "var(--mute)" }}>of {colleges.length}</small></>} />
        <Kpi label="Signups from college emails" value={su} />
        <Kpi label="College credits given" value={sum("credits")} sub={sum("used") + " used so far"} />
        <Kpi label="Paid conversion" value={(su ? (pd / su) * 100 : 0).toFixed(1) + "%"} sub={pd + " paying, " + money(sum("mrr")) + " MRR"} />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row2" style={{ marginBottom: 10 }}>
          <input type="search" placeholder="Search college, domain, code or country" aria-label="Search colleges" value={q} onChange={(e) => setQ(e.target.value)} />
          <Seg label="Status filter" value={st} onChange={setSt} options={[["all", "All"], ["active", "Active"], ["paused", "Paused"]]} />
        </div>
        <div className="tw"><table>
          <thead><tr><th>College</th><th>Domain</th><th>Credits on signup</th><th>Signups</th><th>Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><button className="lnk" onClick={() => setOpen(c.id)}><b>{c.name}</b></button><br />
                  <span style={{ color: "var(--mute)", fontSize: 12 }}>{c.country}{c.code && <> · code <span style={{ fontFamily: "var(--mono)" }}>{c.code}</span>{c.codeMode === "code" && " required"}</>}</span></td>
                <td><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{c.domain}</span>{c.subdomains && <><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>+ subdomains</span></>}</td>
                <td><CreditsInput c={c} onSave={(v) => run(() => api("colleges/" + c.id, "PATCH", { credits: v }), c.name + " now gives " + v + " credits")} /></td>
                <td>{c.stats.signups}
                  {c.cap ? <><div className="cap"><i style={{ width: Math.min(100, (c.stats.granted / c.cap) * 100).toFixed(0) + "%" }} /></div><span style={{ color: "var(--mute)", fontSize: 11 }}>{c.stats.granted} of {c.cap} credit slots</span></> : null}</td>
                <td>{c.stats.paid} <span style={{ color: "var(--mute)", fontSize: 12 }}>{c.stats.conv.toFixed(0)}%</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Switch label={(c.active ? "Pause " : "Activate ") + c.name} checked={c.active} onChange={(v) => run(() => api("colleges/" + c.id, "PATCH", { active: v }), c.name + (v ? " is active again" : " is paused"))} />{" "}
                  <Pill c={c.active ? "p-good" : "p-mute"}>{c.active ? "active" : "paused"}</Pill>
                </td>
                <td><button className="btn sm" onClick={() => setOpen(c.id)}>Open</button></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} style={{ color: "var(--mute)" }}>No colleges match.</td></tr>}
          </tbody>
        </table></div>
        <p className="help">Change the credits number and press Enter or click away to save. Pausing a domain stops new grants. Credits already given stay with the students.</p>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Tester />
        <div className="card"><h3>Credits by college</h3>{chart.length ? <HBars list={chart} /> : <p className="help">No college credits given yet.</p>}<p className="help">Given at signup vs used on videos.</p></div>
      </div>

      {open && (
        <CollegeDrawer
          key={open}
          c={current}
          students={current ? users.filter((u) => u.collegeId === current.id) : []}
          history={current ? history.filter((a) => a.target === current.domain || a.target.endsWith("@" + current.domain) || a.target.endsWith("." + current.domain)).slice(0, 15) : []}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function CreditsInput({ c, onSave }: { c: Row; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(c.credits));
  useEffect(() => setV(String(c.credits)), [c.credits]);
  const commit = () => {
    const n = Math.floor(Number(v));
    if (!(n >= 0 && n <= 500)) { setV(String(c.credits)); return; }
    if (n !== c.credits) onSave(n);
  };
  return <input type="number" className="cin" min={0} max={500} value={v} aria-label={"Signup credits for " + c.name} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />;
}

function Tester() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [ver, setVer] = useState(true);
  const [res, setRes] = useState<SignupResult | null>(null);
  const { run, busy } = useAction();
  useEffect(() => {
    if (!email.trim()) { setRes(null); return; }
    const t = setTimeout(() => { api<SignupResult>("colleges/test", "POST", { email, verified: ver, code }).then(setRes).catch(() => setRes(null)); }, 220);
    return () => clearTimeout(t);
  }, [email, code, ver]);
  return (
    <div className="card">
      <h3>Test an email</h3>
      <p className="help" style={{ margin: "0 0 6px" }}>Runs the real signup rules on the server, without saving anything.</p>
      <label className="f" htmlFor="te">Email</label>
      <input type="text" id="te" placeholder="name@stu.upes.ac.in" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="row2">
        <div><label className="f" htmlFor="tc">Code entered<small>optional</small></label><input type="text" id="tc" placeholder="DUPES10" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <div><Toggle id="tv" title="Email verified" sub="Credits wait for this when required" checked={ver} onChange={setVer} /></div>
      </div>
      <div className="gprev" id="tres">
        {!res ? "Type an email to test it." : res.ok ? (
          <><b>{res.credits ? "+" + res.credits + " credits" : "No extra credits"}</b>{" "}
            {res.held ? <Pill c="p-warn">{res.held} held</Pill> : null}{" "}
            {res.college && <Pill c={res.college.active ? "p-blue" : "p-mute"}>{res.college.name}</Pill>}<br />{res.reason}</>
        ) : <><b className="dn">Blocked</b><br />{res.reason}</>}
      </div>
      <p style={{ margin: "12px 0 0" }}>
        <button className="btn" id="tsim" disabled={!res?.ok || busy} onClick={() => run(() => api<SignupResult & { user: { name: string } }>("colleges/simulate", "POST", { email, verified: ver, code }), (r) => "Signed up " + r.user?.name).then((r) => { if (r) setEmail(""); })}>Simulate this signup</button>
      </p>
      <p className="help">Creates a test user through the same code your signup hook uses, and logs it.</p>
    </div>
  );
}

function CollegeDrawer({ c, students, history, onClose }: { c: Row | null; students: MiniUser[]; history: AuditEntry[]; onClose: () => void }) {
  const isNew = !c;
  const [f, setF] = useState(() => ({
    name: c?.name || "", domain: c?.domain || "", country: c?.country || "", subdomains: c ? c.subdomains : true,
    credits: String(c?.credits ?? 10), expiryDays: String(c?.expiryDays ?? 30), cap: String(c?.cap ?? 0), code: c?.code || "",
    codeMode: c?.codeMode || "domain", starts: c?.starts || "", ends: c?.ends || "", requireVerify: c ? c.requireVerify : true, active: c ? c.active : true, note: c?.note || "",
  }));
  const [err, setErr] = useState("");
  const [bulk, setBulk] = useState("5");
  const { run, busy } = useAction();
  const arm = useArm();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const s = c?.stats;
  const preview = useMemo(() => "Students with @" + (f.domain || "domain") + (f.subdomains ? " or any subdomain" : "") + " get " + (f.credits || 0) + " credits" + (f.codeMode === "code" ? " when they enter " + (f.code || "the code") : "") + (f.requireVerify ? " after verifying their email" : "") + ".", [f]);

  async function save() {
    setErr("");
    const body = { ...f, credits: Number(f.credits), expiryDays: Number(f.expiryDays), cap: Number(f.cap) };
    try {
      if (isNew) await api("colleges", "POST", body); else await api("colleges/" + c!.id, "PATCH", body);
    } catch (e) { setErr((e as Error).message); return; }
    await run(async () => null, isNew ? "College added" : "Saved");
    onClose();
  }

  return (
    <Drawer title={isNew ? "Add college" : c!.name} onClose={onClose}>
      {s && (
        <div className="mini">
          <div><b>{s.signups}</b><span>signups</span></div><div><b>{s.active7}</b><span>active 7d</span></div><div><b>{s.videos}</b><span>videos</span></div>
          <div><b>{s.paid}</b><span>paying</span></div><div><b>{s.credits}</b><span>credits given</span></div><div><b>{money(s.mrr)}</b><span>MRR</span></div>
        </div>
      )}
      <label className="f" htmlFor="cd_name">College name</label><input id="cd_name" placeholder="UPES Dehradun" value={f.name} onChange={set("name")} />
      <label className="f" htmlFor="cd_domain">Email domain<small>no @, no www</small></label><input id="cd_domain" placeholder="upes.ac.in" value={f.domain} onChange={set("domain")} />
      <Toggle id="cd_sub" title="Include subdomains" sub="So stu.upes.ac.in also matches upes.ac.in" checked={f.subdomains} onChange={(v) => setF({ ...f, subdomains: v })} />
      <label className="f" htmlFor="cd_country">Country</label><input id="cd_country" placeholder="India" value={f.country} onChange={set("country")} />
      <div className="row2">
        <div><label className="f" htmlFor="cd_credits">Credits on signup</label><input id="cd_credits" type="number" min={0} max={500} value={f.credits} onChange={set("credits")} /></div>
        <div><label className="f" htmlFor="cd_exp">Expire after (days)<small>0 = never</small></label><input id="cd_exp" type="number" min={0} value={f.expiryDays} onChange={set("expiryDays")} /></div>
        <div><label className="f" htmlFor="cd_cap">Max students<small>0 = no cap</small></label><input id="cd_cap" type="number" min={0} value={f.cap} onChange={set("cap")} /></div>
        <div><label className="f" htmlFor="cd_code">Promo code</label><input id="cd_code" placeholder="DUPES10" value={f.code} onChange={set("code")} /></div>
      </div>
      <label className="f" htmlFor="cd_mode">Who gets the credits</label>
      <select id="cd_mode" value={f.codeMode} onChange={set("codeMode")}><option value="domain">Anyone with a matching email</option><option value="code">Matching email and the promo code</option></select>
      <div className="row2">
        <div><label className="f" htmlFor="cd_starts">Starts</label><input id="cd_starts" type="date" value={f.starts} onChange={set("starts")} /></div>
        <div><label className="f" htmlFor="cd_ends">Ends</label><input id="cd_ends" type="date" value={f.ends} onChange={set("ends")} /></div>
      </div>
      <Toggle id="cd_ver" title="Wait for email verification" sub="Strongly recommended, stops fake signups" checked={f.requireVerify} onChange={(v) => setF({ ...f, requireVerify: v })} />
      <Toggle id="cd_act" title="Domain active" sub="Turn off to pause new grants" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
      <label className="f" htmlFor="cd_note">Internal note</label><textarea id="cd_note" rows={2} placeholder="Campus contact, what was agreed" value={f.note} onChange={set("note")} />
      <div className="gprev">{preview}</div>
      {err && <p className="help dn" role="alert" id="cderr">{err}</p>}
      <p style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn primary" id="cdsave" disabled={busy} onClick={save}>{isNew ? "Add college" : "Save changes"}</button>
        {!isNew && <button className="btn danger" onClick={() => arm.hit("del", () => run(() => api("colleges/" + c!.id, "DELETE"), "Deleted").then(onClose))}>{arm.armed === "del" ? "Click again to delete" : "Delete"}</button>}
      </p>
      {!isNew && (
        <>
          <h3 style={{ marginTop: 20 }}>Give credits to every student here</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" min={1} max={100} value={bulk} aria-label="Credits to add" onChange={(e) => setBulk(e.target.value)} />
            <button className="btn" disabled={busy} onClick={() => run(() => api<{ users: number }>("colleges/" + c!.id + "/credits", "POST", { credits: Number(bulk) }), (r) => "+" + bulk + " credits to " + r.users + " students")}>Add to {students.length} users</button>
          </div>
          <p className="help">Good for exam season or a campus event. Logged in the audit log.</p>
          <h3 style={{ marginTop: 20 }}>Students ({students.length})</h3>
          <div className="tw"><table><thead><tr><th>User</th><th>Plan</th><th>Credits</th></tr></thead><tbody>
            {students.slice(0, 50).map((u) => <tr key={u.id}><td><b>{u.name}</b><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>{u.email}</span></td><td>{u.plan}</td><td>{u.credits}</td></tr>)}
            {!students.length && <tr><td colSpan={3} style={{ color: "var(--mute)" }}>No signups yet.</td></tr>}
          </tbody></table></div>
          <h3 style={{ marginTop: 20 }}>History</h3>
          {history.length ? <ul className="hist">{history.map((a) => <li key={a.id}><b>{a.action}</b> {a.detail}<span><Ago t={a.t} /> · {a.by}</span></li>)}</ul> : <p className="help">No changes yet.</p>}
        </>
      )}
    </Drawer>
  );
}
