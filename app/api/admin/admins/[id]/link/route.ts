import { adminRoute } from "@/lib/route";
import { newLink } from "@/lib/admins";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>("super", async (_req, ctx, { params }) => newLink(ctx, (await params).id));
