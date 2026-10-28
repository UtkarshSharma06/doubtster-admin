import { createClient } from "@supabase/supabase-js";
import type { College, Job, Payment, Plan, User } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpsauvbbcpnzmocoacfw.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

interface AppStateRow {
  user_id: string;
  updated_at?: string;
  state?: {
    plan?: string;
    pcredits?: number;
    spent?: number;
    videos?: Array<{
      id?: string;
      ts?: number;
      title?: string;
      subject?: string;
      lang?: string;
      minutes?: number;
      scenes?: Array<{ dur?: number }>;
      a?: { title?: string };
    }>;
    chats?: unknown[];
    billing?: Array<{
      id?: string;
      ts: number;
      amt?: number;
      label?: string;
    }>;
    profile?: {
      name?: string;
      email?: string;
      lang?: string;
      subjects?: string[];
    };
  };
}

export async function fetchLiveSupabaseData(): Promise<{
  users: User[];
  jobs: Job[];
  payments: Payment[];
  colleges: College[];
} | null> {
  const sb = getClient();
  if (!sb) return null;

  try {
    const [{ data: authRes, error: authErr }, { data: stateRows, error: stateErr }, { data: collegeRows }] = await Promise.all([
      sb.auth.admin.listUsers({ perPage: 1000 }),
      sb.from("app_state").select("*"),
      sb.from("admin_colleges").select("*"),
    ]);

    if (authErr) {
      console.warn("[supabaseSync] listUsers warning:", authErr.message);
      return null;
    }

    const states = (stateRows || []) as AppStateRow[];
    const stateMap = new Map<string, AppStateRow["state"]>(
      states.map((s) => [s.user_id, s.state || {}])
    );

    const users: User[] = (authRes?.users || []).map((u) => {
      const s = stateMap.get(u.id) || {};
      const planRaw =
        typeof s.plan === "string"
          ? s.plan.toLowerCase()
          : typeof s.plan === "object" && s.plan !== null
          ? String((s.plan as Record<string, unknown>).name || (s.plan as Record<string, unknown>).id || "").toLowerCase()
          : "";
      let plan: Plan = "Free";
      if (planRaw.includes("annual")) plan = "Pro annual";
      else if (planRaw.includes("month") || planRaw === "pro") plan = "Pro monthly";
      else if (planRaw.includes("trial")) plan = "Pro trial";

      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      const name =
        s.profile?.name ||
        (meta.full_name as string) ||
        (meta.name as string) ||
        (u.email ? u.email.split("@")[0] : "Student");

      const email = u.email || "";
      const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : "";

      return {
        id: u.id,
        name,
        email,
        plan,
        credits: typeof s.pcredits === "number" ? s.pcredits : 0,
        joined: u.created_at,
        status: "active",
        lang: s.profile?.lang || "en",
        collegeId: (meta.college_id as string) || "",
        country: (meta.country as string) || (domain.endsWith(".in") ? "India" : "Global"),
        source: (u.app_metadata?.provider as string) || (meta.is_student ? "college_signup" : "email"),
        device: "web",
        subject: s.profile?.subjects?.[0] || "General",
        videos: Array.isArray(s.videos) ? s.videos.length : 0,
        chats: Array.isArray(s.chats) ? s.chats.length : 0,
        signupCredits: 0,
        pendingCredits: 0,
        creditsUsed: s.spent || 0,
        verified: !!(u.email_confirmed_at || meta.email_verified),
        lastActive: u.last_sign_in_at || u.created_at,
      };
    });

    const jobs: Job[] = [];
    const payments: Payment[] = [];

    for (const s of states) {
      const st = s.state;
      if (!st) continue;

      if (Array.isArray(st.videos)) {
        for (const v of st.videos) {
          const actualDur = Math.round(
            (v.scenes?.reduce((acc, sc) => acc + (sc.dur || 0), 0) || 120000) / 1000
          );
          jobs.push({
            id: v.id || "j_" + (v.ts || Date.now()),
            q: v.title || v.a?.title || "Explainer Video",
            lang: v.lang || "en",
            domain: v.subject || "math",
            target: (v.minutes || 2) * 60,
            actual: actualDur,
            status: "done",
            verify: "verified",
          });
        }
      }

      if (Array.isArray(st.billing)) {
        for (const b of st.billing) {
          payments.push({
            id: b.id || "pay_" + b.ts,
            userId: s.user_id,
            amount: String(b.amt || 7.99),
            cur: "USD",
            plan: "Pro monthly",
            method: "card",
            ref: b.label || "Subscription",
            error: "",
            date: new Date(b.ts).toISOString(),
            status: "resolved",
          });
        }
      }
    }

    const colleges: College[] = (collegeRows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      country: row.country || "",
      subdomains: !!row.subdomains,
      credits: Number(row.credits ?? 10),
      expiryDays: Number(row.expiry_days ?? 30),
      cap: Number(row.cap ?? 0),
      code: row.code || "",
      codeMode: row.code_mode || "domain",
      requireVerify: !!row.require_verify,
      starts: row.starts || "",
      ends: row.ends || "",
      active: row.active !== false,
      note: row.note || "",
      created: row.created || new Date().toISOString(),
    }));

    return { users, jobs, payments, colleges };
  } catch (err) {
    console.warn("[supabaseSync] Sync error:", err);
    return null;
  }
}

export async function saveCollegeToSupabase(college: College): Promise<void> {
  const sb = getClient();
  if (!sb) return;
  try {
    await (sb.from("admin_colleges") as any).upsert({
      id: college.id,
      name: college.name,
      domain: college.domain,
      country: college.country || "",
      subdomains: !!college.subdomains,
      credits: Number(college.credits ?? 10),
      expiry_days: Number(college.expiryDays ?? 30),
      cap: Number(college.cap ?? 0),
      code: college.code || "",
      code_mode: college.codeMode || "domain",
      require_verify: !!college.requireVerify,
      starts: college.starts || "",
      ends: college.ends || "",
      active: college.active !== false,
      note: college.note || "",
    });
  } catch (err) {
    console.error("[supabaseSync] saveCollegeToSupabase error:", err);
  }
}

export async function deleteCollegeFromSupabase(id: string): Promise<void> {
  const sb = getClient();
  if (!sb) return;
  try {
    await (sb.from("admin_colleges") as any).delete().eq("id", id);
  } catch (err) {
    console.error("[supabaseSync] deleteCollegeFromSupabase error:", err);
  }
}

