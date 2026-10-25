import { adminRoute, body } from "@/lib/route";
import { changeName } from "@/lib/admins";

export const PATCH = adminRoute("self", async (req, ctx) => changeName(ctx, String((await body<{ name: string }>(req)).name || "")));
