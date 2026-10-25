import { adminRoute, body } from "@/lib/route";
import { deletePromo, updatePromo } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const PATCH = adminRoute<C>(["controls", "edit"] as const, async (req, ctx, { params }) => updatePromo((await params).id, await body(req), ctx.admin.email));
export const DELETE = adminRoute<C>(["controls", "edit"] as const, async (_req, ctx, { params }) => deletePromo((await params).id, ctx.admin.email));
