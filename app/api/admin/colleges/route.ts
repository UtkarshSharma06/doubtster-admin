import { adminRoute, body } from "@/lib/route";
import { read } from "@/lib/store";
import { createCollege } from "@/lib/service";
import { cStats } from "@/lib/util";

export const GET = adminRoute(["colleges","view"] as const, async () => {
  const d = await read();
  return d.colleges.map((c) => ({ ...c, stats: cStats(c, d.users, d.flags) }));
});
export const POST = adminRoute(["colleges","edit"] as const, async (req, ctx) => createCollege(await body(req), ctx.admin.email));
