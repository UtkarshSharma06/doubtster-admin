import { adminRoute, body } from "@/lib/route";
import { restoreFlags } from "@/lib/service";

export const POST = adminRoute(["controls", "edit"] as const, async (req, ctx) => restoreFlags(String((await body<{ id: string }>(req)).id || ""), ctx.admin.email));
