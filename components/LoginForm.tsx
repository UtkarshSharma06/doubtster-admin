"use client";
import { useEffect, useRef, useState } from "react";
import AuthFrame from "./AuthFrame";

export default function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<"pw" | "2fa">("pw");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (step === "2fa") codeRef.current?.focus(); }, [step, recovery]);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr("");
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    return { ok: r.ok, j };
  }
  async function submitPw(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/admin/login", { email, password });
    if (!ok) return setErr(j.error || "Could not sign in.");
    if (j.step === "2fa") { setStep("2fa"); setPassword(""); return; }
    window.location.href = next;
  }
  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/admin/login/2fa", { code });
    if (!ok) { if (j.restart) { setStep("pw"); setCode(""); } return setErr(j.error || "That code did not work."); }
    window.location.href = next;
  }
  const capsCheck = (e: React.KeyboardEvent) => setCaps(e.getModifierState && e.getModifierState("CapsLock"));

  return (
    <AuthFrame>
      {step === "pw" ? (
        <form onSubmit={submitPw} noValidate>
          <h1>Sign in to the admin panel</h1>
          <p className="help" style={{ marginBottom: 6 }}>For the Doubtster team. Use the email your super admin invited.</p>
          <label className="f" htmlFor="em">Work email</label>
          <input ref={emailRef} type="email" id="em" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="f" htmlFor="pw">Password</label>
          <div className="pwrow">
            <input type={show ? "text" : "password"} id="pw" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={capsCheck} />
            <button type="button" className="btn sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
          </div>
          {caps && <p className="help" style={{ color: "var(--warn)" }}>Caps Lock is on.</p>}
          {err && <p className="autherr" role="alert">{err}</p>}
          <button className="btn primary wide" disabled={busy || !email || !password}>{busy ? "Checking..." : "Continue"}</button>
          <p className="help">Forgot your password? Ask a super admin for a reset link.</p>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <h1>Two-step sign in</h1>
          <p className="help" style={{ marginBottom: 6 }}>{recovery ? "Type one of the recovery codes you saved. Each works once." : "Open your authenticator app and type the 6-digit code for Doubtster Admin."}</p>
          <label className="f" htmlFor="code">{recovery ? "Recovery code" : "6-digit code"}</label>
          <input ref={codeRef} id="code" className={recovery ? "" : "otp"} inputMode={recovery ? "text" : "numeric"} autoComplete="one-time-code" maxLength={recovery ? 12 : 6} placeholder={recovery ? "ABCD-EFGH" : "000000"} value={code}
            onChange={(e) => setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))} />
          {err && <p className="autherr" role="alert">{err}</p>}
          <button className="btn primary wide" disabled={busy || (recovery ? code.length < 8 : code.length !== 6)}>{busy ? "Checking..." : "Sign in"}</button>
          <p className="help" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="lnk" onClick={() => { setRecovery(!recovery); setCode(""); setErr(""); }}>{recovery ? "Use the app code instead" : "Lost your phone? Use a recovery code"}</button>
            <button type="button" className="lnk" onClick={() => { setStep("pw"); setCode(""); setErr(""); }}>Start again</button>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
