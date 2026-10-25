import { adminRoute } from "@/lib/route";
import { revokeGrant } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>(["payments","edit"] as const, async (_req, ctx, { params }) => revokeGrant((await params).id, ctx.admin.email));
