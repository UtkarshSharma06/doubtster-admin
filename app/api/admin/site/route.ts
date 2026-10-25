import { adminRoute, body } from "@/lib/route";
import { saveSite } from "@/lib/service";

export const PUT = adminRoute(["settings","edit"] as const, async (req, ctx) => saveSite(await body(req), ctx.admin.email));
