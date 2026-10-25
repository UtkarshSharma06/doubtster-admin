"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Flags, Promo } from "@/lib/types";
import { Ago, api, CopyBox, Drawer, Head, Kpi, Pill, Tabs, Toggle, useAction, useArm } from "../ui";

type PromoRow = Omit<Promo, "redemptions">;
type Hist = { id: string; at: string; by: string; changed: string[] };
type Tab = "features" | "limits" | "ai" | "pricing" | "regions" | "announce" | "notify" | "rollout" | "emergency" | "history";
const TABS: [Tab, string][] = [["features", "Features"], ["limits", "Limits and credits"], ["ai", "AI models"], ["pricing", "Pricing and promo codes"], ["regions", "Regions and safety"], ["announce", "Announcements"], ["notify", "Notifications"], ["rollout", "Gradual rollout"], ["emergency", "Emergency"], ["history", "History"]];
const PROVIDERS: [string, string][] = [["gemini", "Gemini API (free tier)"], ["groq", "Groq (gpt-oss-120b)"], ["sambanova", "SambaNova (DeepSeek)"], ["openrouter", "OpenRouter (free models)"], ["paid", "Paid provider"]];
const LANGS: Record<string, string> = { en: "English", fr: "Français", es: "Español", hi: "हिन्दी" };

/* get and set by "a.b.c" path, without changing the original */
const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o);
function setPath<T>(o: T, path: string, v: unknown): T {
  const [k, ...rest] = path.split(".");
  const cur = o as Record<string, unknown>;
  return { ...cur, [k]: rest.length ? setPath(cur[k], rest.join("."), v) : v } as T;
}
function diff(a: unknown, b: unknown, p = ""): string[] {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) return Object.keys(b as object).flatMap((k) => diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], p ? p + "." + k : k));
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [p];
}

export default function Controls({ flags, promos, history, initialTab }: { flags: Flags; promos: PromoRow[]; history: Hist[]; initialTab: string }) {
  const [f, setF] = useState<Flags>(flags);
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t[0] === initialTab)?.[0]) || "features");
  const { run, busy } = useAction();
  const router = useRouter();
  useEffect(() => { setF(flags); }, [flags]);
  useEffect(() => { document.querySelector(".ctl-tabs [aria-selected=true]")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [tab]);
  const changes = useMemo(() => diff(flags, f), [flags, f]);
  const dirty = changes.length > 0;
  const up = (path: string, v: unknown) => setF((cur) => setPath(cur, path, v));
  const go = (t: Tab) => { setTab(t); router.replace("/admin/controls?tab=" + t, { scroll: false }); };

  // field helpers
  const tg = (path: string, title: string, sub = "") => <Toggle id={"f-" + path} title={title} sub={sub} checked={!!get(f, path)} onChange={(v) => up(path, v)} />;
  const num = (path: string, label: string, o: { step?: string; hint?: string; min?: number; max?: number } = {}) => (
    <div><label className="f" htmlFor={"f-" + path}>{label}{o.hint && <small>{o.hint}</small>}</label>
      <input type="number" id={"f-" + path} min={o.min ?? 0} max={o.max} step={o.step || "1"} value={String(get(f, path) ?? "")} onChange={(e) => up(path, e.target.value === "" ? 0 : Number(e.target.value))} /></div>
  );
  const sel = (path: string, label: string, opts: [string, string][]) => (
    <div><label className="f" htmlFor={"f-" + path}>{label}</label>
      <select id={"f-" + path} value={String(get(f, path))} onChange={(e) => up(path, e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );
  const txt = (path: string, label: string, ph = "", type = "text") => (
    <><label className="f" htmlFor={"f-" + path}>{label}</label><input type={type} id={"f-" + path} placeholder={ph} value={String(get(f, path) ?? "")} onChange={(e) => up(path, e.target.value)} /></>
  );
  const range = (path: string, label: string, sub: string) => (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <b>{label}</b><div className="help" style={{ margin: "0 0 6px" }}>{sub}</div>
      <div className="range"><input type="range" min={0} max={100} step={5} value={Number(get(f, path))} onChange={(e) => up(path, Number(e.target.value))} aria-label={label} /><b>{String(get(f, path))}%</b></div>
    </div>
  );

  const save = () => run(() => api<{ changed: string[] }>("config", "PUT", f), (r) => "Saved " + r.changed.length + " change" + (r.changed.length === 1 ? "" : "s"));

  return (
    <>
      <Head title="App controls" sub="Everything the student app can do, its limits, prices and safety switches. Changes go live within 30 seconds.">
        <a className="btn" href="/api/config" target="_blank" rel="noopener">Public config ↗</a>
      </Head>
      <div className="ctl-tabs"><Tabs value={tab} onChange={go} options={TABS} /></div>

      {tab === "features" && (
        <div className="grid g2">
          <Card title="Core features">{tg("chat", "Chat answers", "Free for every user")}{tg("video", "Video generation", "Paid feature")}{tg("notes", "Notes", "Handwritten study notes")}{tg("flashcards", "Flashcards")}{tg("quizzes", "Quizzes")}{tg("signups", "New signups open", "Turn off to pause registrations")}</Card>
          <Card title="Chat experience">{tg("chatx.graphs", "Graphs and diagrams in answers", "Draws charts when a question needs one")}{tg("chatx.stepMode", "Step-by-step mode", "Lets students reveal one step at a time")}{tg("chatx.followUps", "Suggested follow-up questions")}{tg("chatx.share", "Share answer links")}
            <div className="row2">{num("chatx.maxQuestionChars", "Max question length", { hint: "characters" })}{num("chatx.historyDays", "Keep chat history", { hint: "days" })}</div></Card>
          <Card title="Attachments in chat">{tg("attachments.images", "Photos and screenshots")}{tg("attachments.pdf", "PDF files")}{tg("attachments.docs", "Word and slides files")}{tg("attachments.ocr", "Read handwriting and printed text in photos")}
            <div className="row2">{num("attachments.maxMB", "Max file size", { hint: "MB", min: 1, max: 50 })}{num("attachments.maxFiles", "Files per message", { min: 1, max: 10 })}</div></Card>
          <Card title="Languages and subjects">
            <div className="seg" style={{ display: "flex", flexWrap: "wrap", borderRadius: 12, marginBottom: 12 }}>{Object.keys(f.langs).map((l) => <button key={l} aria-pressed={f.langs[l]} onClick={() => up("langs." + l, !f.langs[l])}>{LANGS[l] || l}</button>)}</div>
            <div className="seg" style={{ display: "flex", flexWrap: "wrap", borderRadius: 12 }}>{Object.keys(f.domains).map((d) => <button key={d} aria-pressed={f.domains[d]} onClick={() => up("domains." + d, !f.domains[d])}>{d}</button>)}</div>
            <p className="help">Highlighted means on. Turn a language or subject off to hide it everywhere.</p></Card>
        </div>
      )}

      {tab === "limits" && (
        <div className="grid g2">
          <Card title="Trial and free use">{tg("trial", "Paid trial", "Auto-converts when the trial ends")}
            <div className="row2">{num("trialDays", "Trial days")}{num("trialVideos", "Videos in trial")}{num("freeCredits", "Free credits at signup")}{num("rateLimit", "Free chat messages per day")}</div></Card>
          <Card title="Credits">{tg("creditsx.topups", "Top-up packs on sale")}{tg("creditsx.rollover", "Unused monthly credits roll over", "Off means they reset each month")}{tg("creditsx.referral", "Referral program", "Both people get credits when a friend signs up")}
            <div className="row2">{num("creditsPerVideo", "Credits per video")}{num("creditsx.referrerCredits", "Credits for the referrer")}{num("creditsx.refereeCredits", "Credits for the friend")}{num("creditsx.lowCreditAlert", "Low credit warning at")}</div></Card>
          <Card title="Video generation">{tg("videox.paidPriority", "Paid users skip the queue")}{tg("videox.watermarkTrial", "Watermark on trial videos")}{tg("videox.music", "Background music")}{tg("videox.captions", "Burned-in captions")}
            <div className="row2">{num("videox.defaultSec", "Default length", { hint: "seconds" })}{num("maxVideoMin", "Max length", { hint: "minutes" })}{num("videox.maxPerDayFree", "Videos per day, free")}{num("videox.maxPerDayPaid", "Videos per day, paid")}{num("videox.concurrent", "Videos rendering at once")}{sel("videox.resolution", "Resolution", [["720p", "720p (cheaper)"], ["1080p", "1080p"]])}</div></Card>
          <Card title="Account rules">{tg("safety.requireVerifyForChat", "Verify email before chatting", "Stops throwaway accounts using free chat")}
            <div className="row2">{num("safety.minAge", "Minimum age", { min: 13, max: 21, hint: "16 in some EU countries" })}</div></Card>
        </div>
      )}

      {tab === "ai" && (
        <div className="grid g2">
          <Card title="Which model does what">
            <div className="row2">{sel("ai.chatProvider", "Chat answers", PROVIDERS)}{sel("ai.videoProvider", "Video scripts", PROVIDERS)}{sel("ai.notesProvider", "Notes and flashcards", PROVIDERS)}{sel("provider2", "Second opinion check", PROVIDERS)}</div>
            {tg("verify", "Two-model check and calculator verification", 'Answers show a "verified" badge only when checks pass')}
            {tg("ai.fallback", "Fall back to another provider on errors", "Keeps the app working when a free tier hits its limit")}
            <p className="help">API keys stay in your server env. They never appear here or in the public config.</p></Card>
          <Card title="Answer style">
            <label className="f" htmlFor="f-ai.temperature">Creativity<small>lower is more exact, best for maths</small></label>
            <div className="range"><input id="f-ai.temperature" type="range" min={0} max={1} step={0.05} value={f.ai.temperature} onChange={(e) => up("ai.temperature", Number(e.target.value))} /><b>{f.ai.temperature.toFixed(2)}</b></div>
            <div className="row2">{num("ai.maxTokens", "Longest answer", { hint: "tokens", min: 256, max: 32000 })}</div></Card>
          <Card title="Monthly AI budget">
            <div className="row2">{num("ai.monthlyBudget", "Budget", { hint: "USD per month", step: "1" })}{num("ai.alertAt", "Warn me at", { hint: "% of budget", min: 10, max: 100 })}</div>
            {sel("ai.overBudget", "When the budget runs out", [["alert", "Only warn me"], ["pause_free", "Pause free users, keep paid users working"], ["pause_video", "Pause all video generation"]])}
            <p className="help">Your backend adds up model costs and checks this before each call. With free tiers, keep it low as a safety net.</p></Card>
          <Card title="Video cost estimate">
            <div className="row2">{num("costPerVideoMin", "Cost per video minute", { hint: "USD", step: "0.001" })}</div>
            <p className="help">Used on Analytics to estimate margin.</p></Card>
        </div>
      )}

      {tab === "pricing" && (
        <>
          <div className="grid g2">
            <Card title="Prices, USD">
              <div className="row2">{num("priceTrial", "Trial price", { step: "0.01" })}{num("priceMonthly", "Monthly price", { step: "0.01" })}{num("monthlyCredits", "Monthly credits")}{num("priceAnnual", "Annual price", { step: "0.01" })}{num("topup10", "10 credit top-up", { step: "0.01" })}{num("topup25", "25 credit top-up", { step: "0.01" })}</div>
              <p className="help">One global price. Checkout must read prices on the server, never from the browser. Annual is {(f.priceMonthly ? Math.round((1 - f.priceAnnual / (f.priceMonthly * 12)) * 100) : 0)}% cheaper than 12 months.</p></Card>
            <Card title="What students see"><CopyBox rows={9} label="Price preview" text={`Trial: $${f.priceTrial} for ${f.trialDays} days, ${f.trialVideos} videos\nMonthly: $${f.priceMonthly} for ${f.monthlyCredits} credits\nAnnual: $${f.priceAnnual} (about $${(f.priceAnnual / 12).toFixed(2)} a month)\nTop-ups: 10 for $${f.topup10}, 25 for $${f.topup25}${f.creditsx.topups ? "" : " (off)"}`} /></Card>
          </div>
          <Promos promos={promos} />
        </>
      )}

      {tab === "regions" && (
        <div className="grid g2">
          <Card title="Where students can sign up">
            {tg("regions.eu", "European Union")}{tg("regions.uk", "United Kingdom")}{tg("regions.na", "United States and Canada")}{tg("regions.latam", "Latin America")}{tg("regions.anz", "Australia and New Zealand")}{tg("regions.india", "India")}{tg("regions.row", "Rest of the world")}
            <p className="help">Your signup page reads this and shows a waitlist for regions that are off. Students already signed up keep access.</p></Card>
          <Card title="Safety and honesty">
            {tg("safety.integrityMode", "Academic integrity mode", "Explains and teaches, and will not solve questions that look like a live, timed exam")}
            {sel("safety.moderation", "Content filter", [["relaxed", "Relaxed"], ["standard", "Standard"], ["strict", "Strict (younger students)"]])}
            <label className="f" htmlFor="bw">Blocked words and phrases<small>questions containing these are refused</small></label>
            <WordList value={f.safety.blockedWords} onChange={(v) => up("safety.blockedWords", v)} /></Card>
        </div>
      )}

      {tab === "announce" && (
        <div className="grid g2">
          <Card title="Announcement banner">
            {tg("banner", "Show the banner", "On top of the app and landing page")}
            {txt("bannerMsg", "Text", "New: French, Spanish and Hindi explanations are live.")}
            {txt("bannerLink", "Link", "https://... or /pricing")}
            <div className="row2">{sel("bannerType", "Style", [["info", "Info (blue)"], ["success", "Good news (green)"], ["warning", "Warning (yellow)"]])}{sel("bannerAudience", "Who sees it", [["all", "Everyone"], ["free", "Free users"], ["paid", "Paid users"]])}</div>
            <div className="row2"><div>{txt("bannerStarts", "Show from", "", "datetime-local")}</div><div>{txt("bannerEnds", "Hide after", "", "datetime-local")}</div></div></Card>
          <Card title="Preview">
            <div className={"bnr " + f.bannerType} style={{ opacity: f.banner ? 1 : 0.45 }}>{f.bannerMsg || "Banner text"}{f.bannerLink && <u> Learn more</u>}</div>
            <p className="help">{f.banner ? "Live" + (f.bannerStarts ? " from " + f.bannerStarts.replace("T", " ") : "") + (f.bannerEnds ? " until " + f.bannerEnds.replace("T", " ") : "") + "." : "The banner is off."}</p>
            <h3 style={{ marginTop: 16 }}>Maintenance</h3>
            {tg("maintenance", "Maintenance mode", "Everyone except admins sees the message below")}
            {txt("maintenanceMsg", "Maintenance message")}</Card>
        </div>
      )}

      {tab === "notify" && (
        <div className="grid g2">
          <Card title="Emails to students">{tg("notify.welcome", "Welcome email after signup")}{tg("notify.trialEnding", "Trial ending reminder")}<div className="row2">{num("notify.trialEndingDays", "Days before trial ends", { min: 1, max: 14 })}</div>{tg("notify.lowCredits", "Low credits reminder")}{tg("notify.weeklyDigest", "Weekly study summary")}{tg("notify.winBack", "We miss you email after 14 days away")}</Card>
          <Card title="Good to know"><ul className="chk"><li><span className="m">In the EU and UK, marketing emails need consent. Welcome, trial and credit emails are service emails and are fine.</span></li><li><span className="m">Every email needs an unsubscribe link, even service ones that include tips.</span></li><li><span className="m">Your backend reads these switches before sending. Resend and Brevo both have free tiers.</span></li></ul></Card>
        </div>
      )}

      {tab === "rollout" && (
        <div className="grid g2">
          <Card title="Turn on new features for a share of students">
            {range("rollout.voiceInput", "Voice questions", "Ask by speaking instead of typing")}
            {range("rollout.aiTutorMode", "Tutor mode", "Asks the student questions back instead of giving the answer")}
            {range("rollout.examMode", "Exam practice mode", "Timed practice sets with a score")}
            {range("rollout.newEditor", "New notes editor", "Redesigned notes page")}
            <p className="help">0% is off, 100% is everyone. The app puts each student in a fixed bucket from their user id, so the same students keep the feature as you raise the share.</p></Card>
          <Card title="How to use this"><ul className="chk"><li><span className="m">Start at 5% to 10% and watch errors and feedback for a few days.</span></li><li><span className="m">Raise to 50%, then 100% when it looks good.</span></li><li><span className="m">Something wrong? Slide it to 0% and save. No new release needed.</span></li></ul></Card>
        </div>
      )}

      {tab === "emergency" && <Emergency f={f} saved={flags} />}
      {tab === "history" && <History history={history} />}

      {dirty && tab !== "emergency" && tab !== "history" && (
        <div className="savebar" role="region" aria-label="Unsaved changes">
          <span><b>{changes.length}</b> unsaved change{changes.length === 1 ? "" : "s"}<span className="diff"> · {changes.slice(0, 3).join(", ")}{changes.length > 3 ? " and more" : ""}</span></span>
          <span style={{ display: "flex", gap: 8 }}><button className="btn" onClick={() => setF(flags)}>Discard</button><button className="btn primary" id="savef" disabled={busy} onClick={save}>Save changes</button></span>
        </div>
      )}
    </>
  );
}

function Card({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return <div className="card" style={wide ? { gridColumn: "1 / -1" } : undefined}><h3>{title}</h3>{children}</div>;
}

function WordList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [w, setW] = useState("");
  const add = () => { const x = w.trim().toLowerCase(); if (x && !value.includes(x)) onChange([...value, x]); setW(""); };
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}><input id="bw" value={w} onChange={(e) => setW(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Type and press Enter" /><button className="btn" onClick={add}>Add</button></div>
      <div className="chips">{value.map((x) => <span key={x}>{x}<button aria-label={"Remove " + x} onClick={() => onChange(value.filter((y) => y !== x))}>×</button></span>)}{!value.length && <span style={{ border: 0, background: "none", color: "var(--mute)" }}>No blocked words.</span>}</div>
    </>
  );
}

function Emergency({ f, saved }: { f: Flags; saved: Flags }) {
  const { run, busy } = useAction();
  const arm = useArm();
  const sw = (key: keyof Flags["emergency"], title: string, sub: string) => {
    const on = saved.emergency[key];
    return (
      <div className="tg">
        <div><b>{title} {on && <Pill c="p-bad">on</Pill>}</b><span>{sub}</span></div>
        <button className={"btn " + (on ? "" : "danger")} disabled={busy} onClick={() => arm.hit(key, () => run(() => api("config", "PUT", { emergency: { ...saved.emergency, [key]: !on } }), title + (on ? " is off" : " is on")))}>
          {arm.armed === key ? "Click again to confirm" : on ? "Turn off" : "Turn on"}
        </button>
      </div>
    );
  };
  void f;
  return (
    <div className="grid g2">
      <div className="card danger-card">
        <h3>Emergency switches</h3>
        <p className="help" style={{ marginTop: 0 }}>These save at once, after a second click. A red bar shows on every admin page while any is on. Each one is logged.</p>
        {sw("stopVideo", "Stop all video generation", "Use if costs spike or the video engine misbehaves. Queued jobs wait.")}
        {sw("stopCheckout", "Pause checkout", "Use if payments are failing. Students see a short message instead of the pay button.")}
        {sw("stopSignupCredits", "Pause free credits and codes", "Use if you see abuse: no college credits or credit codes until you turn it off.")}
        {sw("readOnly", "Read-only mode", "Students can read their past answers but cannot ask new questions. Use during data fixes.")}
        <div className="tg"><div><b>Maintenance mode {saved.maintenance && <Pill c="p-bad">on</Pill>}</b><span>Takes the whole app offline for students.</span></div>
          <button className={"btn " + (saved.maintenance ? "" : "danger")} disabled={busy} onClick={() => arm.hit("maint", () => run(() => api("config", "PUT", { maintenance: !saved.maintenance }), saved.maintenance ? "Maintenance off" : "Maintenance on"))}>{arm.armed === "maint" ? "Click again to confirm" : saved.maintenance ? "Turn off" : "Turn on"}</button></div>
      </div>
      <div className="card">
        <h3>If something goes wrong</h3>
        <ul className="chk">
          <li><span className="ic pass">1</span><span>Flip the matching switch here. It reaches the app within 30 seconds.</span></li>
          <li><span className="ic pass">2</span><span>Check the Audit log and your server logs for what changed.</span></li>
          <li><span className="ic pass">3</span><span>Turn on the banner in Announcements to tell students what is happening.</span></li>
          <li><span className="ic pass">4</span><span>Undo a bad settings change from History in one click.</span></li>
        </ul>
      </div>
    </div>
  );
}

function History({ history }: { history: Hist[] }) {
  const { run, busy } = useAction();
  const arm = useArm();
  return (
    <div className="card">
      <h3>Change history</h3>
      <p className="help" style={{ marginTop: 0 }}>Each save keeps the settings from just before it. Undo puts them back. Undo is saved too, so you can undo an undo.</p>
      <div className="tw"><table>
        <thead><tr><th>When</th><th>Who</th><th>What changed</th><th></th></tr></thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id}><td style={{ whiteSpace: "nowrap" }}><Ago t={h.at} /></td><td>{h.by}</td><td><span className="diff">{h.changed.slice(0, 8).join(", ")}{h.changed.length > 8 ? " and " + (h.changed.length - 8) + " more" : ""}</span></td>
              <td><button className="btn sm" disabled={busy} onClick={() => arm.hit(h.id, () => run(() => api("config/restore", "POST", { id: h.id }), "Settings restored"))}>{arm.armed === h.id ? "Sure?" : "Undo this change"}</button></td></tr>
          ))}
          {!history.length && <tr><td colSpan={4} style={{ color: "var(--mute)" }}>No saved changes yet.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function Promos({ promos }: { promos: PromoRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const { run } = useAction();
  const cur = open && open !== "new" ? promos.find((p) => p.id === open) || null : null;
  const live = promos.filter((p) => p.active && (!p.maxUses || p.uses < p.maxUses) && (!p.ends || p.ends >= new Date().toISOString().slice(0, 10)));
  const what = (p: PromoRow) => (p.kind === "credits" ? "+" + p.value + " credits" : p.kind === "percent" ? p.value + "% off " + p.plans.map((x) => x.replace("Pro ", "")).join(", ") : "+" + p.value + " trial days");
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><h3 style={{ margin: 0 }}>Promo codes</h3><button className="btn primary sm" onClick={() => setOpen("new")}>New code</button></div>
      <div className="grid g4" style={{ margin: "12px 0" }}><Kpi label="Live codes" value={live.length} /><Kpi label="Total uses" value={promos.reduce((a, p) => a + p.uses, 0)} /></div>
      <div className="tw"><table>
        <thead><tr><th>Code</th><th>Gives</th><th>Uses</th><th>Dates</th><th>Status</th><th></th></tr></thead>
        <tbody>{promos.map((p) => (
          <tr key={p.id}>
            <td><b style={{ fontFamily: "var(--mono)" }}>{p.code}</b>{p.note && <><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>{p.note}</span></>}</td>
            <td>{what(p)}{p.newUsersOnly && <><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>new accounts only</span></>}</td>
            <td>{p.uses}{p.maxUses ? " / " + p.maxUses : ""}{p.maxUses ? <div className="cap"><i style={{ width: Math.min(100, (p.uses / p.maxUses) * 100) + "%" }} /></div> : null}</td>
            <td style={{ fontSize: 12 }}>{p.starts || "now"} → {p.ends || "no end"}</td>
            <td><Pill c={live.includes(p) ? "p-good" : "p-mute"}>{!p.active ? "paused" : p.maxUses && p.uses >= p.maxUses ? "used up" : p.ends && p.ends < new Date().toISOString().slice(0, 10) ? "ended" : "live"}</Pill></td>
            <td style={{ whiteSpace: "nowrap" }}><button className="btn sm" onClick={() => run(() => api("promos/" + p.id, "PATCH", { active: !p.active }), p.code + (p.active ? " paused" : " is live"))}>{p.active ? "Pause" : "Turn on"}</button> <button className="btn sm" onClick={() => setOpen(p.id)}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="help">College codes like DUPES10 live in Colleges. These are general codes for Instagram, creators and campaigns. Your app checks them through <code>/api/hooks/promo</code>.</p>
      {open && <PromoDrawer key={open} p={cur} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PromoDrawer({ p, onClose }: { p: PromoRow | null; onClose: () => void }) {
  const [f, setF] = useState(() => ({ code: p?.code || "", kind: p?.kind || "credits", value: String(p?.value ?? 2), plans: p?.plans || ["Pro monthly", "Pro annual"], maxUses: String(p?.maxUses ?? 0), perUser: String(p?.perUser ?? 1), starts: p?.starts || "", ends: p?.ends || "", active: p ? p.active : true, newUsersOnly: p ? p.newUsersOnly : true, note: p?.note || "" }));
  const [err, setErr] = useState("");
  const { run, busy } = useAction();
  const arm = useArm();
  async function save() {
    setErr("");
    const b = { ...f, value: Number(f.value), maxUses: Number(f.maxUses), perUser: Number(f.perUser) };
    try { if (p) await api("promos/" + p.id, "PATCH", b); else await api("promos", "POST", b); } catch (e) { return setErr((e as Error).message); }
    run(async () => null, p ? "Code saved" : "Code created");
    onClose();
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer title={p ? "Edit " + p.code : "New promo code"} onClose={onClose}>
      <label className="f" htmlFor="pc-code">Code</label><input id="pc-code" style={{ fontFamily: "var(--mono)", textTransform: "uppercase" }} placeholder="INSTA3" value={f.code} onChange={set("code")} />
      <label className="f" htmlFor="pc-kind">What it gives</label>
      <select id="pc-kind" value={f.kind} onChange={set("kind")}><option value="credits">Free video credits</option><option value="percent">Percent off a plan</option><option value="trial_days">Extra trial days</option></select>
      <label className="f" htmlFor="pc-val">{f.kind === "credits" ? "Credits" : f.kind === "percent" ? "Percent off" : "Extra days"}</label><input id="pc-val" type="number" min={1} value={f.value} onChange={set("value")} />
      {f.kind === "percent" && (
        <div className="seg" style={{ display: "flex", flexWrap: "wrap", borderRadius: 12, marginTop: 10 }}>
          {["Pro trial", "Pro monthly", "Pro annual"].map((pl) => <button key={pl} aria-pressed={f.plans.includes(pl)} onClick={() => setF({ ...f, plans: f.plans.includes(pl) ? f.plans.filter((x) => x !== pl) : [...f.plans, pl] })}>{pl.replace("Pro ", "")}</button>)}
        </div>
      )}
      <div className="row2">
        <div><label className="f" htmlFor="pc-max">Total uses<small>0 = no limit</small></label><input id="pc-max" type="number" min={0} value={f.maxUses} onChange={set("maxUses")} /></div>
        <div><label className="f" htmlFor="pc-per">Uses per student</label><input id="pc-per" type="number" min={1} max={10} value={f.perUser} onChange={set("perUser")} /></div>
        <div><label className="f" htmlFor="pc-s">Starts</label><input id="pc-s" type="date" value={f.starts} onChange={set("starts")} /></div>
        <div><label className="f" htmlFor="pc-e">Ends</label><input id="pc-e" type="date" value={f.ends} onChange={set("ends")} /></div>
      </div>
      <Toggle id="pc-new" title="New accounts only" sub="Stops people making the code a habit" checked={f.newUsersOnly} onChange={(v) => setF({ ...f, newUsersOnly: v })} />
      <Toggle id="pc-act" title="Live" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
      <label className="f" htmlFor="pc-note">Note<small>who it is for</small></label><input id="pc-note" value={f.note} onChange={set("note")} placeholder="Creator @studywithme, Oct campaign" />
      {err && <p className="autherr" role="alert">{err}</p>}
      <p style={{ marginTop: 14, display: "flex", gap: 8 }}><button className="btn primary" disabled={busy || !f.code} onClick={save}>{p ? "Save code" : "Create code"}</button>
        {p && <button className="btn danger" onClick={() => arm.hit("del", () => run(() => api("promos/" + p.id, "DELETE"), "Code deleted").then(onClose))}>{arm.armed === "del" ? "Click again" : "Delete"}</button>}</p>
    </Drawer>
  );
}
