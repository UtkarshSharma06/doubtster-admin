"use client";
import { useMemo, useState } from "react";
import type { Plan, User } from "@/lib/types";
import { PLANS } from "@/lib/types";
import { ROLES, type Role } from "@/lib/perm";
import { countBy, fmt, isPaid } from "@/lib/util";
import { filterUsers, type UserFilter } from "@/lib/filters";
import { Ago, api, download, Drawer, Head, Kpi, Note, Pill, Toggle, useAction, useCopy } from "../ui";
import GrantDrawer from "./GrantDrawer";

export default function Users({ users, colleges, trialDays, isSuper, adminEmails }: { users: User[]; colleges: { id: string; name: string }[]; trialDays: number; isSuper: boolean; adminEmails: string[] }) {
  const [f, setF] = useState<UserFilter>({ q: "", plan: "all", college: "all", country: "all", source: "all" });
  const [open, setOpen] = useState<string | null>(null);
  const [grantFor, setGrantFor] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const L = useMemo(() => filterUsers(users, f), [users, f]);
  const shown = L.slice(0, page * 50);
  const paid = L.filter(isPaid).length;
  const cname = (id: string) => colleges.find((c) => c.id === id)?.name || "";
  const opts = (k: "country" | "source") => countBy(users, (u) => u[k]);
  const set = (k: keyof UserFilter) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const qs = new URLSearchParams(f as unknown as Record<string, string>).toString();
  const cur = open ? users.find((u) => u.id === open) : null;

  return (
    <>
      <Head title="Users" sub="Search people, filter by college or country, add credits, change plans or suspend accounts.">
        <Note>Sample data</Note>
        <button className="btn" onClick={() => download("users/export?" + qs)}>Export CSV</button>
      </Head>
      <div className="grid g4">
        <Kpi label="Users shown" value={L.length} />
        <Kpi label="Paying" value={<>{paid} <small style={{ fontSize: 14, color: "var(--mute)" }}>{L.length ? Math.round((paid / L.length) * 100) : 0}%</small></>} />
        <Kpi label="From a college" value={L.filter((u) => u.collegeId).length} />
        <Kpi label="Email not verified" value={L.filter((u) => !u.verified).length} />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="ufil">
          <input type="search" placeholder="Search name or email" aria-label="Search users" value={f.q} onChange={set("q")} />
          <select aria-label="Plan" value={f.plan} onChange={set("plan")}><option value="all">All plans</option>{PLANS.map((p) => <option key={p}>{p}</option>)}</select>
          <select aria-label="College" value={f.college} onChange={set("college")}><option value="all">All colleges</option><option value="none">No college</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Country" value={f.country} onChange={set("country")}><option value="all">All countries</option>{opts("country").map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}</select>
          <select aria-label="Source" value={f.source} onChange={set("source")}><option value="all">All sources</option>{opts("source").map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}</select>
        </div>
        <div className="tw"><table>
          <thead><tr><th>User</th><th>Plan</th><th>Credits</th><th>College</th><th>Country</th><th>Source</th><th>Videos</th><th>Last active</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className="click" tabIndex={0} onClick={() => setOpen(u.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(u.id); }}>
                <td><b>{u.name}</b><br /><span style={{ color: "var(--mute)" }}>{u.email}</span>{!u.verified && <> <Pill c="p-warn">unverified</Pill></>}</td>
                <td><Pill c={u.plan === "Free" ? "p-mute" : "p-blue"}>{u.plan}</Pill>{u.expires && u.plan !== "Free" && <><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>until {fmt(u.expires)}{u.manual && " · manual"}</span></>}</td>
                <td>{u.credits}{u.signupCredits ? <><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>+{u.signupCredits} college</span></> : null}</td>
                <td>{cname(u.collegeId) || <span style={{ color: "var(--mute)" }}>-</span>}</td>
                <td>{u.country || "-"}</td><td>{u.source || "-"}</td><td>{u.videos || 0}</td>
                <td style={{ whiteSpace: "nowrap" }}>{u.lastActive ? <Ago t={u.lastActive} /> : "-"}</td>
                <td><Pill c={u.status === "active" ? "p-good" : "p-bad"}>{u.status}</Pill></td>
              </tr>
            ))}
            {!L.length && <tr><td colSpan={9} style={{ color: "var(--mute)" }}>No users match.</td></tr>}
          </tbody>
        </table></div>
        <p className="help">{shown.length} of {L.length} shown ({users.length} total). Export downloads every user that matches the filters.
          {shown.length < L.length && <> <button className="btn sm" onClick={() => setPage(page + 1)}>Show 50 more</button></>}</p>
      </div>
      {cur && <UserDrawer key={cur.id} u={cur} isSuper={isSuper} isAdmin={adminEmails.includes(cur.email)} college={cname(cur.collegeId)} onClose={() => setOpen(null)} onGrant={() => { setGrantFor(cur.id); setOpen(null); }} />}
      {grantFor && <GrantDrawer users={users} userId={grantFor} trialDays={trialDays} onClose={() => setGrantFor(null)} />}
    </>
  );
}

function UserDrawer({ u, college, onClose, onGrant, isSuper, isAdmin }: { u: User; college: string; onClose: () => void; onGrant: () => void; isSuper: boolean; isAdmin: boolean }) {
  const [plan, setPlan] = useState<Plan>(u.plan);
  const [credits, setCredits] = useState(String(u.credits));
  const [active, setActive] = useState(u.status === "active");
  const { run, busy } = useAction();
  return (
    <Drawer title={u.name} onClose={onClose}>
      <p style={{ color: "var(--mute)", margin: "4px 0 0" }}>{u.email}{!u.verified && <> · <span className="dn">email not verified</span></>}</p>
      <div className="mini"><div><b>{u.videos || 0}</b><span>videos</span></div><div><b>{u.chats || 0}</b><span>chats</span></div><div><b>{u.creditsUsed || 0}</b><span>credits used</span></div></div>
      <div className="tw"><table><tbody>
        <tr><td>College</td><td><b>{college || "-"}</b>{u.signupCredits ? " · +" + u.signupCredits + " signup credits" : ""}{u.pendingCredits ? " · " + u.pendingCredits + " held" : ""}</td></tr>
        <tr><td>Country</td><td>{u.country || "-"}</td></tr>
        <tr><td>Came from</td><td>{u.source || "-"}</td></tr>
        <tr><td>Device, language</td><td>{u.device || "-"}, {(u.lang || "").toUpperCase()}</td></tr>
        <tr><td>Main subject</td><td>{u.subject || "-"}</td></tr>
        <tr><td>Joined, last active</td><td>{u.joined}, {u.lastActive ? <Ago t={u.lastActive} /> : "-"}</td></tr>
      </tbody></table></div>
      <label className="f" htmlFor="dplan">Plan</label>
      <select id="dplan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select>
      <p className="help">{u.expires && u.plan !== "Free" ? "Active until " + fmt(u.expires) + (u.manual ? " (granted manually)" : "") : "No plan expiry set"}</p>
      <label className="f" htmlFor="dcr">Video credits</label>
      <div style={{ display: "flex", gap: 8 }}><input type="number" id="dcr" min={0} value={credits} onChange={(e) => setCredits(e.target.value)} /><button className="btn" onClick={() => setCredits(String((Number(credits) || 0) + 5))}>+5</button></div>
      <Toggle id="dact" title="Account active" sub="Turn off to suspend sign-in" checked={active} onChange={setActive} />
      <p style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn primary" disabled={busy} onClick={() => run(() => api("users/" + u.id, "PATCH", { plan, credits: Number(credits), status: active ? "active" : "suspended" }), "User updated").then((r) => { if (r) onClose(); })}>Save</button>
        <button className="btn" onClick={onGrant}>Manual grant</button>
      </p>
      {isSuper && <Promote u={u} isAdmin={isAdmin} />}
    </Drawer>
  );
}

function Promote({ u, isAdmin }: { u: User; isAdmin: boolean }) {
  const [role, setRole] = useState<Role>("support");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const { run, busy } = useAction();
  const copy = useCopy();
  if (isAdmin) return <><h3 style={{ marginTop: 20 }}>Admin access</h3><p className="help">This person already has admin access. Manage it in Admins and access.</p></>;
  return (
    <>
      <h3 style={{ marginTop: 20 }}>Give admin panel access</h3>
      <p className="help" style={{ marginTop: 0 }}>Makes a separate admin login for {u.email}. Their student account does not change.</p>
      <label className="f" htmlFor="prole">Role</label>
      <select id="prole" value={role} onChange={(e) => setRole(e.target.value as Role)}>{(["viewer", "support", "content", "growth", "admin", "super"] as Role[]).map((r) => <option key={r} value={r}>{ROLES[r as Exclude<Role, "custom">].label}</option>)}</select>
      <p className="help">{ROLES[role as Exclude<Role, "custom">].about} Fine-tune it later in Admins and access.</p>
      {err && <p className="autherr" role="alert">{err}</p>}
      {url ? (
        <div className="linkbox"><span style={{ flex: 1 }}>{url}</span><button className="btn sm primary" onClick={() => copy(url, "Link copied")}>Copy</button></div>
      ) : (
        <p><button className="btn" disabled={busy} onClick={async () => { setErr(""); try { const r = await api<{ token: string }>("users/" + u.id + "/promote", "POST", { role }); setUrl(window.location.origin + "/admin/invite/" + r.token); run(async () => null, "Invite link created"); } catch (e) { setErr((e as Error).message); } }}>Create invite link</button></p>
      )}
    </>
  );
}
