import { adminRoute } from "@/lib/route";
import { rejectPayment } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>(["payments","edit"] as const, async (_req, ctx, { params }) => rejectPayment((await params).id, ctx.admin.email));
