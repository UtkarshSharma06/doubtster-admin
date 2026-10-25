import { adminRoute, body } from "@/lib/route";
import { saveSecurity } from "@/lib/admins";

export const PUT = adminRoute("super", async (req, ctx) => saveSecurity(ctx, await body(req)));
