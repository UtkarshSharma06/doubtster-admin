import { adminRoute, body } from "@/lib/route";
import { jobAction } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>(["videos","edit"] as const, async (req, ctx, { params }) => {
  const b = await body<{ action: "retry" | "cancel" }>(req);
  return jobAction((await params).id, b.action === "retry" ? "retry" : "cancel", ctx.admin.email);
});
