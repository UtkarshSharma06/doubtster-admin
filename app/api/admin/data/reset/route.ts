import { adminRoute } from "@/lib/route";
import { resetData } from "@/lib/service";

export const POST = adminRoute("super" as const, async (_req, ctx) => resetData(ctx.admin.email));
