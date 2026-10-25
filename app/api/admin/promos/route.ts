import { adminRoute, body } from "@/lib/route";
import { createPromo } from "@/lib/service";

export const POST = adminRoute(["controls", "edit"] as const, async (req, ctx) => createPromo(await body(req), ctx.admin.email));
