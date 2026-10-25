import { adminRoute, body } from "@/lib/route";
import { updateUser } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const PATCH = adminRoute<C>(["users","edit"] as const, async (req, ctx, { params }) => updateUser((await params).id, await body(req), ctx.admin.email));
