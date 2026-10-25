import { adminRoute, body } from "@/lib/route";
import { saveSeo } from "@/lib/service";

export const PUT = adminRoute(["seo","edit"] as const, async (req, ctx) => saveSeo(await body(req), ctx.admin.email));
