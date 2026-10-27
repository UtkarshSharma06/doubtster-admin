"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/* ---------- toast ---------- */
const ToastCtx = createContext<(m: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m); setOn(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setOn(false), 1800);
  }, []);
  useEffect(() => {
    const h = (e: Event) => show(String((e as CustomEvent).detail));
    window.addEventListener("dt-toast", h);
    return () => window.removeEventListener("dt-toast", h);
  }, [show]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={"toast" + (on ? " on" : "")} role="status">{msg}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- API calls ---------- */
let READ_ONLY = false;
/** Set by the shell when the admin can only view the current page. */
export function setReadOnly(v: boolean) { READ_ONLY = v; }

export async function api<T = unknown>(path: string, method = "POST", body?: unknown): Promise<T> {
  if (READ_ONLY && method !== "GET" && !path.startsWith("colleges/test")) throw new Error("You have view-only access here.");
  const r = await fetch("/api/admin/" + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { window.location.href = "/admin/login"; throw new Error("Sign in again"); }
  if (!r.ok) throw new Error((j as { error?: string }).error || "Something went wrong");
  return j as T;
}

/** Runs an API call, shows a toast, refreshes server data. Returns true on success. */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string | ((r: T) => string)): Promise<T | null> => {
      setBusy(true);
      try {
        const r = await fn();
        if (ok) toast(typeof ok === "function" ? ok(r) : ok);
        router.refresh();
        return r;
      } catch (e) {
        toast((e as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [router, toast],
  );
  return { run, busy };
}

export function download(path: string) {
  if (READ_ONLY) { window.dispatchEvent(new CustomEvent("dt-toast", { detail: "Downloading needs edit access." })); return; }
  const a = document.createElement("a");
  a.href = "/api/admin/" + path;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function useCopy() {
  const toast = useToast();
  return (text: string, msg = "Copied") => {
    const fb = () => {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(msg); } catch { toast("Select the text and copy it"); }
      ta.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(msg), fb); else fb();
  };
}

/** A button that needs two clicks within 3 seconds. */
export function useArm() {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return {
    armed,
    hit: (id: string, go: () => void) => { if (armed === id) { setArmed(null); go(); } else setArmed(id); },
  };
}

/* ---------- small pieces ---------- */
export function Head({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="head">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      <div className="acts">{children}</div>
    </div>
  );
}

export function Toggle({ id, title, sub, checked, onChange, disabled }: { id: string; title: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="tg">
      <div><b>{title}</b>{sub && <span>{sub}</span>}</div>
      <label className="sw">
        <input type="checkbox" id={id} checked={checked} disabled={disabled} aria-label={title} onChange={(e) => onChange(e.target.checked)} />
        <i />
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="sw">
      <input type="checkbox" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}

export function Kpi({ label, value, sub, cls }: { label: string; value: ReactNode; sub?: ReactNode; cls?: string }) {
  return (
    <div className="card kpi">
      <div className="l">{label}</div>
      <div className={"v " + (cls || "")}>{value}</div>
      {sub && <div className="d" style={{ color: "var(--mute)" }}>{sub}</div>}
    </div>
  );
}

export const Pill = ({ c, children }: { c: string; children: ReactNode }) => <span className={"pill " + c}>{children}</span>;
export const Note = ({ children }: { children: ReactNode }) => <span className="note">{children}</span>;

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function HBars({ list, color }: { list: [string, number, string?][]; color?: string }) {
  const mx = Math.max(1, ...list.map((x) => x[1]));
  return (
    <div className="hb">
      {list.map(([l, v, s]) => (
        <div className="hr" key={l}>
          <span className="hl" title={l}>{l}</span>
          <span className="ht"><i style={{ width: ((v / mx) * 100).toFixed(1) + "%", background: color || "var(--blue)" }} /></span>
          <span className="hv">{v.toLocaleString("en-US")}{s && <small>{s}</small>}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ vals, labels, color }: { vals: number[]; labels: string[]; color: string }) {
  const W = 640, H = 190, P = { l: 34, r: 20, t: 10, b: 22 }, mx = Math.max(1, ...vals) * 1.1, n = vals.length;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (n - 1);
  const y = (v: number) => H - P.b - (v / mx) * (H - P.t - P.b);
  const d = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chart" suppressHydrationWarning>
      {[0, 1, 2, 3, 4].map((k) => {
        const gv = (mx / 4) * k, gy = y(gv);
        return (
          <g key={k}>
            <line x1={P.l} x2={W - P.r} y1={gy} y2={gy} stroke="var(--line)" strokeWidth="1" />
            <text x={P.l - 6} y={gy + 4} textAnchor="end" suppressHydrationWarning>{Math.round(gv)}</text>
          </g>
        );
      })}
      {[0, Math.floor(n / 2), n - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" suppressHydrationWarning>{labels[i] || ""}</text>)}
      <path d={`${d} L${x(n - 1)} ${H - P.b} L${x(0)} ${H - P.b} Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(vals[n - 1])} r="4" fill={color} />
    </svg>
  );
}

export function CopyBox({ text, rows = 12, label }: { text: string; rows?: number; label?: string }) {
  const copy = useCopy();
  return (
    <div className="out">
      <textarea className="code" readOnly rows={rows} value={text} aria-label={label || "Output"} />
      <button className="btn sm" type="button" onClick={() => copy(text)}>Copy</button>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <aside className="drawer" aria-label={title}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 20 }}>{title}</h2>
        <button className="btn sm" onClick={onClose}>Close</button>
      </div>
      {children}
    </aside>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <>
      <label className="f" htmlFor={id}>{label}{hint && <small>{hint}</small>}</label>
      {children}
    </>
  );
}

export function useLabels(n: number) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return useMemo(() => {
    const out: string[] = [];
    if (!mounted) {
      for (let i = 0; i < n; i++) out.push("");
      return out;
    }
    const base = Date.now();
    for (let i = 0; i < n; i++) {
      const d = new Date(base - (n - 1 - i) * 864e5);
      out.push(d.getDate() + "/" + (d.getMonth() + 1));
    }
    return out;
  }, [n, mounted]);
}

/** Seeded random series for sample charts (same numbers every load). */
export function series(seed: number, n: number, start: number, growth: number, noise: number) {
  let s = seed;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const o: number[] = [];
  for (let i = 0; i < n; i++) o.push(Math.max(0, Math.round(start + i * growth + (r() - 0.5) * noise)));
  return o;
}

export function Ago({ t }: { t: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!t) return null;
  if (!mounted) {
    return <span suppressHydrationWarning>{t.slice(0, 10)}</span>;
  }
  const m = Math.round((Date.now() - new Date(t).getTime()) / 6e4);
  const s = m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return <span suppressHydrationWarning>{s}</span>;
}
