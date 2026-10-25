import { adminRoute, body } from "@/lib/route";
import { read } from "@/lib/store";
import { inviteAdmin, publicAdmin } from "@/lib/admins";
import type { Perms, Role } from "@/lib/perm";

export const GET = adminRoute("super", async () => (await read()).admins.map(publicAdmin));
export const POST = adminRoute("super", async (req, ctx) => inviteAdmin(ctx, await body<{ email: string; name?: string; role: Role; perms?: Partial<Perms> }>(req)));
