import { adminRoute, body } from "@/lib/route";
import { read } from "@/lib/store";
import { importData } from "@/lib/service";
import type { Data } from "@/lib/types";

export const GET = adminRoute("super" as const, async () => {
  const { admins: _a, sessions: _s, invites: _i, ...rest } = await read();
  void _a; void _s; void _i;
  return rest;
});
export const POST = adminRoute("super" as const, async (req, ctx) => importData(await body<Data>(req), ctx.admin.email));
