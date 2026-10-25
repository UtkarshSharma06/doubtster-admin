import { adminRoute, body } from "@/lib/route";
import { bulkCollegeCredits } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>(["colleges","edit"] as const, async (req, ctx, { params }) => {
  const b = await body<{ credits: number }>(req);
  return bulkCollegeCredits((await params).id, b.credits, ctx.admin.email);
});
