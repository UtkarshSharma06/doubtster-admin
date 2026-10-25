import { adminRoute, csvResponse } from "@/lib/route";
import { read } from "@/lib/store";
import { cStats } from "@/lib/util";

export const GET = adminRoute(["colleges","edit"] as const, async () => {
  const d = await read();
  return csvResponse("doubtster-colleges", [
    ["name", "domain", "subdomains", "country", "active", "signup_credits", "expiry_days", "cap", "code", "code_mode", "require_verify", "starts", "ends", "signups", "credits_given", "credits_used", "paid", "mrr_usd"],
    ...d.colleges.map((c) => {
      const s = cStats(c, d.users, d.flags);
      return [c.name, c.domain, c.subdomains, c.country, c.active, c.credits, c.expiryDays, c.cap || "", c.code, c.codeMode, c.requireVerify, c.starts, c.ends, s.signups, s.credits, s.used, s.paid, s.mrr.toFixed(2)];
    }),
  ]);
});
