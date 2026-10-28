"use client";
import { useEffect, useRef, useState } from "react";
import AuthFrame from "./AuthFrame";

export default function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<"pw" | "2fa" | "email_otp">("pw");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [recovery, setRecovery] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "2fa") codeRef.current?.focus();
    if (step === "email_otp") otpInputRef.current?.focus();
  }, [step, recovery]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setInterval(() => {
      setOtpCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [otpCountdown]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    setErr("");
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    return { ok: r.ok, j };
  }

  async function submitPw(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/admin/login", { email, password });
    if (!ok) return setErr(j.error || "Could not sign in.");
    if (j.step === "2fa") {
      setStep("2fa");
      setPassword("");
      return;
    }
    window.location.href = next;
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/admin/login/2fa", { code });
    if (!ok) {
      if (j.restart) {
        setStep("pw");
        setCode("");
      }
      return setErr(j.error || "That code did not work.");
    }
    window.location.href = next;
  }

  async function sendEmailOtp() {
    if (!email) {
      setErr("Enter your work email first.");
      emailRef.current?.focus();
      return;
    }
    const { ok, j } = await post("/api/admin/login/otp/send", { email });
    if (!ok) return setErr(j.error || "Could not send verification code.");
    setStep("email_otp");
    setOtpCountdown(45);
    setOtpCode("");
  }

  async function submitEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/admin/login/otp/verify", { email, code: otpCode });
    if (!ok) return setErr(j.error || "Invalid or expired verification code.");
    window.location.href = next;
  }

  const capsCheck = (e: React.KeyboardEvent) =>
    setCaps(e.getModifierState && e.getModifierState("CapsLock"));

  return (
    <AuthFrame>
      {step === "pw" && (
        <form onSubmit={submitPw} noValidate>
          <h1>Sign in to the admin panel</h1>
          <p className="help" style={{ marginBottom: 6 }}>
            For the Doubtster team. Use the email your super admin invited.
          </p>
          <label className="f" htmlFor="em">Work email</label>
          <input
            ref={emailRef}
            type="email"
            id="em"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="f" htmlFor="pw">Password</label>
          <div className="pwrow">
            <input
              type={show ? "text" : "password"}
              id="pw"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={capsCheck}
            />
            <button
              type="button"
              className="btn sm"
              onClick={() => setShow(!show)}
              aria-pressed={show}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {caps && <p className="help" style={{ color: "var(--warn)" }}>Caps Lock is on.</p>}
          {err && <p className="autherr" role="alert">{err}</p>}
          <button className="btn primary wide" disabled={busy || !email || !password}>
            {busy ? "Checking..." : "Continue"}
          </button>

          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              type="button"
              className="lnk"
              onClick={sendEmailOtp}
              disabled={busy}
              style={{ fontSize: 13 }}
            >
              📧 Or sign in with a 6-digit email code (OTP)
            </button>
          </div>
          <p className="help" style={{ marginTop: 10 }}>Forgot your password? Ask a super admin for a reset link.</p>
        </form>
      )}

      {step === "email_otp" && (
        <form onSubmit={submitEmailOtp} noValidate>
          <h1>Email verification code</h1>
          <p className="help" style={{ marginBottom: 12 }}>
            We sent a 6-digit one-time code to <b>{email}</b>. Enter it below to sign in.
          </p>
          <label className="f" htmlFor="admin-otp">6-digit verification code</label>
          <input
            ref={otpInputRef}
            id="admin-otp"
            className="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {err && <p className="autherr" role="alert">{err}</p>}
          <button
            className="btn primary wide"
            disabled={busy || otpCode.length !== 6}
            style={{ marginTop: 12 }}
          >
            {busy ? "Verifying..." : "Verify and sign in"}
          </button>

          <p className="help" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button
              type="button"
              className="lnk"
              onClick={sendEmailOtp}
              disabled={otpCountdown > 0 || busy}
            >
              {otpCountdown > 0 ? `Resend code in ${otpCountdown}s` : "Resend code"}
            </button>
            <button
              type="button"
              className="lnk"
              onClick={() => {
                setStep("pw");
                setOtpCode("");
                setErr("");
              }}
            >
              Back to password
            </button>
          </p>
        </form>
      )}

      {step === "2fa" && (
        <form onSubmit={submitCode} noValidate>
          <h1>Two-step sign in</h1>
          <p className="help" style={{ marginBottom: 6 }}>
            {recovery
              ? "Type one of the recovery codes you saved. Each works once."
              : "Open your authenticator app and type the 6-digit code for Doubtster Admin."}
          </p>
          <label className="f" htmlFor="code">{recovery ? "Recovery code" : "6-digit code"}</label>
          <input
            ref={codeRef}
            id="code"
            className={recovery ? "" : "otp"}
            inputMode={recovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            maxLength={recovery ? 12 : 6}
            placeholder={recovery ? "ABCD-EFGH" : "000000"}
            value={code}
            onChange={(e) =>
              setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))
            }
          />
          {err && <p className="autherr" role="alert">{err}</p>}
          <button
            className="btn primary wide"
            disabled={busy || (recovery ? code.length < 8 : code.length !== 6)}
          >
            {busy ? "Checking..." : "Sign in"}
          </button>
          <p className="help" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="lnk"
              onClick={() => {
                setRecovery(!recovery);
                setCode("");
                setErr("");
              }}
            >
              {recovery ? "Use the app code instead" : "Lost your phone? Use a recovery code"}
            </button>
            <button
              type="button"
              className="lnk"
              onClick={() => {
                setStep("pw");
                setCode("");
                setErr("");
              }}
            >
              Start again
            </button>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
