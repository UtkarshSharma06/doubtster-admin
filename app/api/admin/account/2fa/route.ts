import { adminRoute, body } from "@/lib/route";
import { confirm2fa, disable2fa, start2fa } from "@/lib/admins";

export const POST = adminRoute("self", async (_req, ctx) => start2fa(ctx));
export const PUT = adminRoute("self", async (req, ctx) => confirm2fa(ctx, String((await body<{ code: string }>(req)).code || "")));
export const DELETE = adminRoute("self", async (req, ctx) => disable2fa(ctx, String((await body<{ password: string }>(req)).password || "")));
