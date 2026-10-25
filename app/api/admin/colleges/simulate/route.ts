import { adminRoute, body } from "@/lib/route";
import { registerSignup } from "@/lib/service";

// Creates a sample user through the real signup rules, so you can watch counts and caps move.
export const POST = adminRoute(["colleges","edit"] as const, async (req, ctx) => {
  const b = await body<{ email: string; verified: boolean; code?: string }>(req);
  return registerSignup({ email: b.email, verified: !!b.verified, code: b.code, source: b.code ? "college code" : "direct" }, ctx.admin.email);
});
