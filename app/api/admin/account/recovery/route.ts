import { adminRoute } from "@/lib/route";
import { newRecoveryCodes } from "@/lib/admins";

export const POST = adminRoute("self", async (_req, ctx) => newRecoveryCodes(ctx));
