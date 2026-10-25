import { adminRoute, body } from "@/lib/route";
import { deletePost, savePost, HttpError } from "@/lib/service";
import type { Post } from "@/lib/types";

type C = { params: Promise<{ id: string }> };
export const PUT = adminRoute<C>(["blog","edit"] as const, async (req, ctx, { params }) => {
  const b = await body<{ post: Post; commitSlug?: boolean }>(req);
  if (!b.post || b.post.id !== (await params).id) throw new HttpError(400, "ID mismatch");
  return savePost(b.post, ctx.admin.email, false, !!b.commitSlug);
});
export const DELETE = adminRoute<C>(["blog","edit"] as const, async (_req, ctx, { params }) => deletePost((await params).id, ctx.admin.email));
