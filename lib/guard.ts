import "server-only";
import { redirect } from "next/navigation";
import { currentCtx } from "./route";
import { homeFor, type Section } from "./perm";

/** Use at the top of every admin page. Sends people where they are allowed to be. */
export async function guard(section?: Section | "super") {
  const ctx = await currentCtx();
  if (!ctx) redirect("/admin/login");
  if (ctx.mustSetup2fa) redirect("/admin/account?setup=2fa");
  if (section === "super") {
    if (ctx.admin.role !== "super") redirect(homeFor(ctx.perms));
  } else if (section && ctx.perms[section] === "none") {
    redirect(homeFor(ctx.perms));
  }
  return ctx;
}
