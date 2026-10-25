import { adminRoute, body } from "@/lib/route";
import { manualGrant } from "@/lib/service";

export const POST = adminRoute(["payments","edit"] as const, async (req, ctx) => manualGrant(await body(req), ctx.admin.email));
