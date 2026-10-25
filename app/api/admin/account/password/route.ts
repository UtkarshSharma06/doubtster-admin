import { adminRoute, body, ipOf, rateLimit } from "@/lib/route";
import { changePassword } from "@/lib/admins";
import { HttpError } from "@/lib/service";

export const POST = adminRoute("self", async (req, ctx) => {
  if (!rateLimit("pw:" + ctx.admin.id + ipOf(req), 5, 15 * 60e3)) throw new HttpError(429, "Too many tries. Wait 15 minutes.");
  const b = await body<{ current: string; next: string }>(req);
  return changePassword(ctx, String(b.current || ""), String(b.next || ""));
});
