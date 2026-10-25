"use client";
import { useState } from "react";
import type { AuditEntry } from "@/lib/types";
import type { PublicAdmin } from "@/lib/admins";
import { ROLES, SECTIONS } from "@/lib/perm";
import { Ago, api, Head, Pill, useAction, useCopy } from "../ui";

type S = { id: string; device: string; ip: string; createdAt: string; lastSeen: string; current: boolean };

export default function Account({ me, sessions, activity, mustSetup, required }: { me: PublicAdmin; sessions: S[]; activity: AuditEntry[]; mustSetup: boolean; required: boolean }) {
  const { run, busy } = useAction();
  const [name, setName] = useState(me.name);
  return (
    <>
      <Head title="My account" sub="Your profile, password, two-step sign in and where you are signed in." />
      {mustSetup && !me.twoFactor && <div className="robar" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>{required ? "Your super admin requires two-step sign in. Set it up below to open the rest of the panel." : "Set up two-step sign in below. It takes one minute."}</div>}
      <div className="grid g2">
        <div className="card">
          <h3>Profile</h3>
          <label className="f" htmlFor="an">Name</label>
          <div style={{ display: "flex", gap: 8 }}><input id="an" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn" disabled={busy || !name.trim() || name === me.name} onClick={() => run(() => api("account", "PATCH", { name }), "Name saved")}>Save</button></div>
          <div className="tw" style={{ marginTop: 12 }}><table><tbody>
            <tr><td>Email</td><td><b>{me.email}</b></td></tr>
            <tr><td>Role</td><td><Pill c={me.role === "super" ? "p-blue" : "p-mute"}>{me.role === "custom" ? "Custom" : ROLES[me.role].label}</Pill></td></tr>
            <tr><td>Last sign in</td><td>{me.lastLogin ? <Ago t={me.lastLogin} /> : "-"}{me.lastIp ? " · " + me.lastIp : ""}</td></tr>
          </tbody></table></div>
          <h3 style={{ marginTop: 16 }}>What you can do</h3>
          <div className="perm-grid">
            {SECTIONS.map(([s, l]) => <div key={s} style={{ display: "contents" }}><span>{l}</span><Pill c={me.perms[s] === "edit" ? "p-good" : me.perms[s] === "view" ? "p-blue" : "p-mute"}>{me.perms[s] === "edit" ? "edit" : me.perms[s] === "view" ? "view" : "no access"}</Pill></div>)}
          </div>
        </div>
        <TwoFactor me={me} required={required} />
      </div>
      <div className="grid g2" style={{ marginTop: 14 }}>
        <Password />
        <div className="card">
          <h3>Where you are signed in</h3>
          <div className="tw"><table>
            <thead><tr><th>Device</th><th>Network</th><th>Last active</th><th></th></tr></thead>
            <tbody>{sessions.map((s) => (
              <tr key={s.id}><td><b>{s.device}</b>{s.current && <> <Pill c="p-good">this device</Pill></>}<br /><span style={{ color: "var(--mute)", fontSize: 12 }}>since <Ago t={s.createdAt} /></span></td><td>{s.ip}</td><td><Ago t={s.lastSeen} /></td>
                <td>{!s.current && <button className="btn sm danger" onClick={() => run(() => api("sessions/" + s.id, "DELETE"), "Signed out that device")}>Sign out</button>}</td></tr>
            ))}</tbody>
          </table></div>
          <p className="help">Changing your password signs out every other device.</p>
          <h3 style={{ marginTop: 16 }}>Recent security activity</h3>
          {activity.length ? <ul className="hist">{activity.map((a) => <li key={a.id}><b>{a.action}</b> {a.detail}<span><Ago t={a.t} />{a.ip ? " · " + a.ip : ""}</span></li>)}</ul> : <p className="help">Nothing yet.</p>}
        </div>
      </div>
    </>
  );
}

function Password() {
  const [cur, setCur] = useState(""), [nx, setNx] = useState(""), [nx2, setNx2] = useState(""), [err, setErr] = useState("");
  const { run, busy } = useAction();
  async function save() {
    setErr("");
    if (nx !== nx2) return setErr("The new passwords do not match.");
    try { await api("account/password", "POST", { current: cur, next: nx }); } catch (e) { return setErr((e as Error).message); }
    setCur(""); setNx(""); setNx2("");
    run(async () => null, "Password changed. Other devices are signed out.");
  }
  return (
    <div className="card">
      <h3>Password</h3>
      <input type="text" autoComplete="username" hidden readOnly />
      <label className="f" htmlFor="pc">Current password</label><input id="pc" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <label className="f" htmlFor="pn">New password<small>12+ characters</small></label><input id="pn" type="password" autoComplete="new-password" value={nx} onChange={(e) => setNx(e.target.value)} />
      <label className="f" htmlFor="pn2">Type it again</label><input id="pn2" type="password" autoComplete="new-password" value={nx2} onChange={(e) => setNx2(e.target.value)} />
      {err && <p className="autherr" role="alert">{err}</p>}
      <p style={{ marginTop: 12 }}><button className="btn primary" disabled={busy || !cur || nx.length < 12} onClick={save}>Change password</button></p>
    </div>
  );
}

function TwoFactor({ me, required }: { me: PublicAdmin; required: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; svg: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const { run, busy } = useAction();
  const copy = useCopy();
  async function start() { setErr(""); try { setSetup(await api("account/2fa", "POST")); } catch (e) { setErr((e as Error).message); } }
  async function confirm() {
    setErr("");
    try { const r = await api<{ codes: string[] }>("account/2fa", "PUT", { code }); setCodes(r.codes); setSetup(null); setCode(""); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="card">
      <h3>Two-step sign in {me.twoFactor ? <Pill c="p-good">on</Pill> : <Pill c="p-warn">off</Pill>}</h3>
      {codes ? (
        <>
          <p className="help" style={{ marginTop: 0 }}>Save these recovery codes somewhere safe, like a password manager. Each one works once if you lose your phone. You will not see them again.</p>
          <div className="codes">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <p style={{ display: "flex", gap: 8, marginTop: 10 }}><button className="btn" onClick={() => copy(codes.join("\n"), "Codes copied")}>Copy codes</button><button className="btn primary" onClick={() => { setCodes(null); run(async () => null); if (required) window.location.href = "/admin"; }}>I saved them</button></p>
        </>
      ) : setup ? (
        <>
          <p className="help" style={{ marginTop: 0 }}>1. Scan this with Google Authenticator, 1Password, Authy or Microsoft Authenticator.</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: setup.svg }} />
          <p className="help">Can&apos;t scan? Enter this key by hand:</p>
          <div className="linkbox"><span style={{ flex: 1 }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</span><button className="btn sm" onClick={() => copy(setup.secret, "Key copied")}>Copy</button></div>
          <label className="f" htmlFor="c2">2. Type the 6-digit code it shows</label>
          <input id="c2" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          {err && <p className="autherr" role="alert">{err}</p>}
          <p style={{ display: "flex", gap: 8, marginTop: 10 }}><button className="btn primary" disabled={code.length !== 6} onClick={confirm}>Turn on</button><button className="btn" onClick={() => setSetup(null)}>Cancel</button></p>
        </>
      ) : me.twoFactor ? (
        <>
          <p className="help" style={{ marginTop: 0 }}>Signing in needs your password and a code from your phone. {me.recoveryLeft} recovery codes left.</p>
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" disabled={busy} onClick={async () => { try { setCodes((await api<{ codes: string[] }>("account/recovery", "POST")).codes); } catch (e) { setErr((e as Error).message); } }}>New recovery codes</button>
          </p>
          {!required && (
            <>
              <label className="f" htmlFor="dpw">Turn off with your password</label>
              <div style={{ display: "flex", gap: 8 }}><input id="dpw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn danger" disabled={!pw || busy} onClick={() => run(() => api("account/2fa", "DELETE", { password: pw }), "Two-step sign in is off").then(() => setPw(""))}>Turn off</button></div>
            </>
          )}
          {err && <p className="autherr" role="alert">{err}</p>}
        </>
      ) : (
        <>
          <p className="help" style={{ marginTop: 0 }}>Add a code from your phone to every sign in. Even if someone gets your password, they cannot get in.</p>
          {err && <p className="autherr" role="alert">{err}</p>}
          <p><button className="btn primary" onClick={start}>Set up two-step sign in</button></p>
        </>
      )}
    </div>
  );
}
