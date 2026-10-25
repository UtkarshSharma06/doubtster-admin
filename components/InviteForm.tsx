"use client";
import { useState } from "react";
import AuthFrame from "./AuthFrame";

type Info = { email: string; name: string; kind: "invite" | "reset"; role: string; expiresAt: string; require2fa: boolean };

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return pw.length < 12 ? Math.min(s, 1) : s;
}

export default function InviteForm({ token, info }: { token: string; info: Info }) {
  const [name, setName] = useState(info.name);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const st = strength(pw);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setErr("The two passwords do not match.");
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw, name }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Could not save.");
    if (j.step === "2fa") { window.location.href = "/admin/login"; return; }
    window.location.href = info.require2fa ? "/admin/account?setup=2fa" : "/admin";
  }
  return (
    <AuthFrame>
      <form onSubmit={submit} noValidate>
        <h1>{info.kind === "invite" ? "Set up your admin access" : "Choose a new password"}</h1>
        <p className="help" style={{ marginBottom: 6 }}>
          {info.kind === "invite" ? <>You were invited as <b>{info.role}</b> for <b>{info.email}</b>.</> : <>For <b>{info.email}</b>.</>} This link works until {new Date(info.expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.
        </p>
        {info.kind === "invite" && <><label className="f" htmlFor="nm">Your name</label><input id="nm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></>}
        <input type="email" value={info.email} autoComplete="username" readOnly hidden />
        <label className="f" htmlFor="p1">Password<small>12+ characters</small></label>
        <input id="p1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="meter-s" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < st ? "on s" + st : ""} />)}</div>
        <p className="help">{pw.length < 12 ? "A short sentence you can remember works well." : st >= 4 ? "Strong." : "Good. Longer is stronger."}</p>
        <label className="f" htmlFor="p2">Type it again</label>
        <input id="p2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {err && <p className="autherr" role="alert">{err}</p>}
        <button className="btn primary wide" disabled={busy || pw.length < 12 || !pw2}>{busy ? "Saving..." : info.kind === "invite" ? "Create my access" : "Save new password"}</button>
        {info.require2fa && <p className="help">Next you will set up two-step sign in with an authenticator app.</p>}
      </form>
    </AuthFrame>
  );
}
