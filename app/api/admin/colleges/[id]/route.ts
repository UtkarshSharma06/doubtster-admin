import { adminRoute, body } from "@/lib/route";
import { deleteCollege, updateCollege } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const PATCH = adminRoute<C>(["colleges","edit"] as const, async (req, ctx, { params }) => updateCollege((await params).id, await body(req), ctx.admin.email));
export const DELETE = adminRoute<C>(["colleges","edit"] as const, async (_req, ctx, { params }) => deleteCollege((await params).id, ctx.admin.email));
