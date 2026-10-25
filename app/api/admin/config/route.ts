import { adminRoute, body } from "@/lib/route";
import { read } from "@/lib/store";
import { saveFlags } from "@/lib/service";

export const GET = adminRoute(["controls","view"] as const, async () => (await read()).flags);
export const PUT = adminRoute(["controls","edit"] as const, async (req, ctx) => saveFlags(await body(req), ctx.admin.email));
