import { adminRoute } from "@/lib/route";
import { revokeSession } from "@/lib/admins";

type C = { params: Promise<{ id: string }> };
export const DELETE = adminRoute<C>("self", async (_req, ctx, { params }) => revokeSession(ctx, (await params).id));
