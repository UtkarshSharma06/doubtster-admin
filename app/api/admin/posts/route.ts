import { adminRoute, body } from "@/lib/route";
import { savePost } from "@/lib/service";
import type { Post } from "@/lib/types";

export const POST = adminRoute(["blog","edit"] as const, async (req, ctx) => savePost(await body<Post>(req), ctx.admin.email, true));
