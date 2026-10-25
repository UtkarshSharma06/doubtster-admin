import { adminRoute, body } from "@/lib/route";
import { removeAdmin, updateAdmin } from "@/lib/admins";

type C = { params: Promise<{ id: string }> };
export const PATCH = adminRoute<C>("super", async (req, ctx, { params }) => updateAdmin(ctx, (await params).id, await body(req)));
export const DELETE = adminRoute<C>("super", async (_req, ctx, { params }) => removeAdmin(ctx, (await params).id));
