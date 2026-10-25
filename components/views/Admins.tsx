"use client";
import { useState } from "react";
import type { AuditEntry, Security } from "@/lib/types";
import type { PublicAdmin } from "@/lib/admins";
import { permsFor, ROLES, SECTIONS, type Perms, type Role } from "@/lib/perm";
import { Ago, api, Drawer, Head, Kpi, Pill, Toggle, useAction, useArm, useCopy } from "../ui";
import PermEditor from "../PermEditor";

type Sess = { id: string; adminId: string; email: string; device: string; ip: string; lastSeen: string; current: boolean };
const ROLE_OPTS: Role[] = ["super", "admin", "support", "content", "growth", "viewer", "custom"];
const roleName = (r: Role) => (r === "custom" ? "Custom" : ROLES[r].label);

export default function Admins({ admins, meId, sessions, invites, security, history }: { admins: PublicAdmin[]; meId: string; sessions: Sess[]; invites: Record<string, string>; security: Security; history: AuditEntry[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string; kind: string } | null>(null);
  const { run } = useAction();
  const cur = open && open !== "new" ? admins.find((a) => a.id === open) || null : null;
  const showLink = (email: string, token: string, kind: string) => setLink({ email, url: window.location.origin + "/admin/invite/" + token, kind });

  return (
    <>
      <Head title="Admins and access" sub="Give people access to the admin panel, choose what they can see and change, and keep sign in safe.">
        <button className="btn primary" onClick={() => setOpen("new")}>Invite admin</button>
      </Head>
      {link && <LinkCard link={link} onClose={() => setLink(null)} />}
      <div className="grid g4">
        <Kpi label="Active admins" value={admins.filter((a) => a.status === "active").length} />
        <Kpi label="Waiting to accept" value={admins.filter((a) => a.status === "invited").length} />
        <Kpi label="Two-step sign in on" value={admins.filter((a) => a.status === "active" && a.twoFactor).length + " / " + admins.filter((a) => a.status === "active").length} cls={admins.some((a) => a.status === "active" && !a.twoFactor) ? "dn" : ""} />
        <Kpi label="Signed-in devices" value={sessions.length} />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="tw"><table>
          <thead><tr><th>Admin</th><th>Role</th><th>Two-step</th><th>Last sign in</th><th>Status</th><th></th></tr></thead>
          <tbody>{admins.map((a) => (
            <tr key={a.id} className="click" tabIndex={0} onClick={() => setOpen(a.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(a.id); }}>
              <td><b>{a.name}</b>{a.id === meId && <> <Pill c="p-blue">you</Pill></>}<br /><span style={{ color: "var(--mute)" }}>{a.email}</span>{a.userId && <> <Pill c="p-mute">app user</Pill></>}</td>
              <td><Pill c={a.role === "super" ? "p-blue" : "p-mute"}>{roleName(a.role)}</Pill></td>
              <td>{a.twoFactor ? <Pill c="p-good">on</Pill> : <Pill c={security.require2fa ? "p-bad" : "p-warn"}>off</Pill>}</td>
              <td>{a.lastLogin ? <><Ago t={a.lastLogin} /><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>{a.lastIp}</span></> : "-"}</td>
              <td>{a.locked ? <Pill c="p-bad">locked</Pill> : a.status === "active" ? <Pill c="p-good">active</Pill> : a.status === "invited" ? <Pill c="p-warn">{invites[a.id] ? "invited" : "invite expired"}</Pill> : <Pill c="p-mute">turned off</Pill>}</td>
              <td><button className="btn sm" onClick={(e) => { e.stopPropagation(); setOpen(a.id); }}>Manage</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <SecurityCard s={security} />
        <div className="card">
          <h3>Signed-in devices</h3>
          <div className="tw"><table>
            <thead><tr><th>Admin</th><th>Device</th><th>Last active</th><th></th></tr></thead>
            <tbody>{sessions.map((s) => (
              <tr key={s.id}><td>{s.email}{s.current && <> <Pill c="p-good">you, here</Pill></>}</td><td>{s.device}<br /><span style={{ color: "var(--mute)", fontSize: 12 }}>{s.ip}</span></td><td><Ago t={s.lastSeen} /></td>
                <td>{!s.current && <button className="btn sm danger" onClick={() => run(() => api("sessions/" + s.id, "DELETE"), "Signed out")}>Sign out</button>}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h3>What each role can do</h3>
          <div className="tw"><table className="hm">
            <thead><tr><th>Section</th>{(["super", "admin", "support", "content", "growth", "viewer"] as const).map((r) => <th key={r}>{ROLES[r].label}</th>)}</tr></thead>
            <tbody>{SECTIONS.map(([s, l]) => (
              <tr key={s}><td>{l}</td>{(["super", "admin", "support", "content", "growth", "viewer"] as const).map((r) => { const v = ROLES[r].perms[s]; return <td key={r} style={{ color: v === "edit" ? "var(--good)" : v === "view" ? "var(--blue)" : "var(--mute)" }}>{v === "edit" ? "edit" : v === "view" ? "view" : "·"}</td>; })}</tr>
            ))}
              <tr><td>Admins and security</td><td style={{ color: "var(--good)" }}>edit</td>{[1, 2, 3, 4, 5].map((i) => <td key={i} style={{ color: "var(--mute)" }}>·</td>)}</tr>
              <tr><td>Backup, import, reset</td><td style={{ color: "var(--good)" }}>edit</td>{[1, 2, 3, 4, 5].map((i) => <td key={i} style={{ color: "var(--mute)" }}>·</td>)}</tr>
            </tbody>
          </table></div>
          <p className="help">Pick Custom to set each section by hand. Downloading data needs edit access on that section.</p>
        </div>
        <div className="card">
          <h3>Team history</h3>
          {history.length ? <ul className="hist">{history.map((a) => <li key={a.id}><b>{a.action}</b> {a.target} {a.detail && <>· {a.detail}</>}<span><Ago t={a.t} /> · {a.by}{a.ip ? " · " + a.ip : ""}</span></li>)}</ul> : <p className="help">Nothing yet.</p>}
        </div>
      </div>

      {open === "new" && <InviteDrawer onClose={() => setOpen(null)} onLink={showLink} />}
      {cur && <AdminDrawer key={cur.id} a={cur} isMe={cur.id === meId} invitedUntil={invites[cur.id]} onClose={() => setOpen(null)} onLink={showLink} />}
    </>
  );
}

function LinkCard({ link, onClose }: { link: { email: string; url: string; kind: string }; onClose: () => void }) {
  const copy = useCopy();
  return (
    <div className="card" style={{ marginBottom: 14, borderColor: "var(--blue)" }}>
      <h3>{link.kind === "reset" ? "Password reset link" : "Invite link"} for {link.email}</h3>
      <p className="help" style={{ marginTop: 0 }}>Send this to them yourself, for example on WhatsApp or email. It works once and expires. Anyone with the link can set the password, so send it only to them.</p>
      <div className="linkbox"><span style={{ flex: 1 }}>{link.url}</span><button className="btn sm primary" onClick={() => copy(link.url, "Link copied")}>Copy</button></div>
      <p style={{ marginTop: 10 }}><button className="btn sm" onClick={onClose}>Done</button></p>
    </div>
  );
}

function RolePicker({ role, perms, onRole, onPerms, disabled }: { role: Role; perms: Perms; onRole: (r: Role) => void; onPerms: (p: Perms) => void; disabled?: boolean }) {
  return (
    <>
      <label className="f" htmlFor="rl">Role</label>
      <select id="rl" value={role} disabled={disabled} onChange={(e) => { const r = e.target.value as Role; onRole(r); if (r !== "custom") onPerms(permsFor(r)); }}>
        {ROLE_OPTS.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
      </select>
      <p className="help">{role === "custom" ? "Choose access for each section below." : ROLES[role].about}</p>
      <div style={{ marginTop: 10 }}><PermEditor perms={role === "custom" ? perms : permsFor(role)} onChange={onPerms} disabled={role !== "custom" || disabled} /></div>
    </>
  );
}

function InviteDrawer({ onClose, onLink }: { onClose: () => void; onLink: (email: string, token: string, kind: string) => void }) {
  const [email, setEmail] = useState(""), [name, setName] = useState(""), [role, setRole] = useState<Role>("support"), [perms, setPerms] = useState<Perms>(permsFor("support"));
  const [err, setErr] = useState("");
  const { run, busy } = useAction();
  async function send() {
    setErr("");
    try {
      const r = await api<{ token: string; admin: PublicAdmin }>("admins", "POST", { email, name, role, perms });
      onLink(r.admin.email, r.token, "invite");
      run(async () => null, "Invite created");
      onClose();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Drawer title="Invite admin" onClose={onClose}>
      <label className="f" htmlFor="ie">Email</label><input id="ie" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@doubtster.com" />
      <label className="f" htmlFor="inm">Name<small>optional</small></label><input id="inm" value={name} onChange={(e) => setName(e.target.value)} />
      <RolePicker role={role} perms={perms} onRole={setRole} onPerms={setPerms} />
      {role === "super" && <p className="autherr">A super admin can add and remove other admins, including you. Give this only to people you fully trust.</p>}
      {err && <p className="autherr" role="alert">{err}</p>}
      <p style={{ marginTop: 14 }}><button className="btn primary" disabled={busy || !email} onClick={send}>Create invite link</button></p>
      <p className="help">You get a one-time link to send them. They choose their own password. Nothing is emailed automatically.</p>
    </Drawer>
  );
}

function AdminDrawer({ a, isMe, invitedUntil, onClose, onLink }: { a: PublicAdmin; isMe: boolean; invitedUntil?: string; onClose: () => void; onLink: (email: string, token: string, kind: string) => void }) {
  const [name, setName] = useState(a.name), [role, setRole] = useState<Role>(a.role), [perms, setPerms] = useState<Perms>(a.perms);
  const [err, setErr] = useState("");
  const { run, busy } = useAction();
  const arm = useArm();
  const dirty = name !== a.name || role !== a.role || (role === "custom" && JSON.stringify(perms) !== JSON.stringify(a.perms));
  async function save() {
    setErr("");
    try { await api("admins/" + a.id, "PATCH", { name, role, perms }); } catch (e) { return setErr((e as Error).message); }
    run(async () => null, "Access updated");
  }
  const act = (action: string, msg: string) => run(() => api("admins/" + a.id + "/action", "POST", { action }), msg);
  return (
    <Drawer title={a.name} onClose={onClose}>
      <p style={{ color: "var(--mute)", margin: "4px 0 0" }}>{a.email}</p>
      <div className="mini">
        <div><b>{a.status === "invited" ? "invited" : a.status === "active" ? "active" : "off"}</b><span>status</span></div>
        <div><b>{a.twoFactor ? "on" : "off"}</b><span>two-step</span></div>
        <div><b>{a.lastLogin ? new Date(a.lastLogin).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "never"}</b><span>last sign in</span></div>
      </div>
      {a.status === "invited" && <p className="help">{invitedUntil ? "Invite link works until " + new Date(invitedUntil).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) + "." : "The invite link expired."}</p>}
      <label className="f" htmlFor="adn">Name</label><input id="adn" value={name} onChange={(e) => setName(e.target.value)} />
      <RolePicker role={role} perms={perms} onRole={setRole} onPerms={setPerms} disabled={isMe} />
      {isMe && <p className="help">You cannot change your own role. Another super admin can.</p>}
      {err && <p className="autherr" role="alert">{err}</p>}
      <p style={{ marginTop: 14 }}><button className="btn primary" disabled={busy || !dirty} onClick={save}>Save access</button></p>

      <h3 style={{ marginTop: 20 }}>Account</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={busy} onClick={async () => { try { const r = await api<{ token: string; kind: string }>("admins/" + a.id + "/link", "POST"); onLink(a.email, r.token, r.kind); run(async () => null); onClose(); } catch (e) { setErr((e as Error).message); } }}>{a.status === "invited" ? "New invite link" : "Password reset link"}</button>
        {!isMe && a.status !== "invited" && <button className="btn" onClick={() => run(() => api("admins/" + a.id, "PATCH", { status: a.status === "active" ? "disabled" : "active" }), a.status === "active" ? "Access turned off" : "Access turned on")}>{a.status === "active" ? "Turn off access" : "Turn access back on"}</button>}
        {!isMe && <button className="btn" onClick={() => act("signout", "Signed out on every device")}>Sign out everywhere</button>}
        {a.locked && <button className="btn" onClick={() => act("unlock", "Unlocked")}>Unlock</button>}
        {!isMe && a.twoFactor && <button className="btn" onClick={() => arm.hit("2fa", () => act("reset2fa", "Two-step sign in reset"))}>{arm.armed === "2fa" ? "Sure? They set it up again" : "Reset two-step"}</button>}
      </div>
      <p className="help">Turning off access signs them out at once. Their history stays in the audit log.</p>
      {!isMe && (
        <>
          <h3 style={{ marginTop: 20 }}>Remove</h3>
          <button className="btn danger" onClick={() => arm.hit("rm", () => run(() => api("admins/" + a.id, "DELETE"), "Admin removed").then(onClose))}>{arm.armed === "rm" ? "Click again to remove " + a.email : "Remove admin"}</button>
        </>
      )}
    </Drawer>
  );
}

function SecurityCard({ s }: { s: Security }) {
  const [f, setF] = useState({ ...s, ips: s.ipAllowlist.join("\n") });
  const { run, busy } = useAction();
  const dirty = JSON.stringify({ ...f, ipAllowlist: undefined, ips: undefined }) !== JSON.stringify({ ...s, ipAllowlist: undefined }) || f.ips.trim() !== s.ipAllowlist.join("\n");
  const n = (k: "sessionHours" | "idleMinutes" | "maxFailed" | "lockMinutes" | "inviteHours", l: string) => (
    <div><label className="f" htmlFor={"sec-" + k}>{l}</label><input id={"sec-" + k} type="number" min={1} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></div>
  );
  return (
    <div className="card">
      <h3>Sign in security</h3>
      <Toggle id="sec-2fa" title="Require two-step sign in for everyone" sub="Admins without it can only open My account until they set it up" checked={f.require2fa} onChange={(v) => setF({ ...f, require2fa: v })} />
      <div className="row2">{n("sessionHours", "Session length (hours)")}{n("idleMinutes", "Sign out after idle (min)")}{n("maxFailed", "Wrong tries before lock")}{n("lockMinutes", "Lock for (minutes)")}{n("inviteHours", "Invite links last (hours)")}</div>
      <label className="f" htmlFor="sec-ip">Allowed networks<small>one IP or range per line, empty = anywhere</small></label>
      <textarea id="sec-ip" rows={3} placeholder={"203.0.113.7\n198.51.100.0/24"} value={f.ips} onChange={(e) => setF({ ...f, ips: e.target.value })} />
      <p className="help">Applies to everyone except super admins, so you cannot lock yourself out.</p>
      <p style={{ marginTop: 12 }}><button className="btn primary" disabled={busy || !dirty} onClick={() => run(() => api("security", "PUT", { require2fa: f.require2fa, sessionHours: f.sessionHours, idleMinutes: f.idleMinutes, maxFailed: f.maxFailed, lockMinutes: f.lockMinutes, inviteHours: f.inviteHours, ipAllowlist: f.ips.split(/\n+/).map((x) => x.trim()).filter(Boolean) }), "Security saved")}>Save security</button></p>
    </div>
  );
}
