import { adminRoute, body } from "@/lib/route";
import { adminAction } from "@/lib/admins";
import { HttpError } from "@/lib/service";

type C = { params: Promise<{ id: string }> };
export const POST = adminRoute<C>("super", async (req, ctx, { params }) => {
  const { action } = await body<{ action: string }>(req);
  if (action !== "signout" && action !== "unlock" && action !== "reset2fa") throw new HttpError(400, "Unknown action");
  return adminAction(ctx, (await params).id, action);
});
