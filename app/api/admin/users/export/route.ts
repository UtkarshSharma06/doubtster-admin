import { adminRoute, csvResponse } from "@/lib/route";
import { read } from "@/lib/store";
import { filterUsers } from "@/lib/filters";

export const GET = adminRoute(["users","edit"] as const, async (req) => {
  const d = await read();
  const q = req.nextUrl.searchParams;
  const list = filterUsers(d.users, { q: q.get("q") || "", plan: q.get("plan") || "all", college: q.get("college") || "all", country: q.get("country") || "all", source: q.get("source") || "all" });
  const cname = (id: string) => d.colleges.find((c) => c.id === id)?.name || "";
  return csvResponse("doubtster-users", [
    ["id", "name", "email", "plan", "credits", "college", "country", "source", "device", "lang", "subject", "videos", "chats", "signup_credits", "credits_used", "verified", "status", "joined", "last_active"],
    ...list.map((u) => [u.id, u.name, u.email, u.plan, u.credits, cname(u.collegeId), u.country, u.source, u.device, u.lang, u.subject, u.videos, u.chats, u.signupCredits, u.creditsUsed, u.verified, u.status, u.joined, (u.lastActive || "").slice(0, 10)]),
  ]);
});
