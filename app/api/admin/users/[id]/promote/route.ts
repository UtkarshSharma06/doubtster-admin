import { adminRoute, body } from "@/lib/route";
import { promoteUser } from "@/lib/admins";
import type { Perms, Role } from "@/lib/perm";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>("super", async (req, ctx, { params }) => {
  const b = await body<{ role: Role; perms?: Partial<Perms> }>(req);
  return promoteUser(ctx, (await params).id, b.role, b.perms);
});
