import { hookRoute } from "@/lib/hook";
import { redeemPromo } from "@/lib/service";

/*
  Called by your app when a student types a promo code.
  Body: { code, userKey (user id or email), isNewUser?, plan?, dryRun? }
  dryRun: true checks the code without using it (for showing the price before paying).
  Then apply the result yourself: credits, % off at checkout (server side), or extra trial days.
*/
export const POST = hookRoute(async (b) =>
  redeemPromo({ code: String(b.code || ""), userKey: String(b.userKey || ""), isNewUser: !!b.isNewUser, plan: b.plan ? String(b.plan) : undefined, dryRun: !!b.dryRun }),
);
