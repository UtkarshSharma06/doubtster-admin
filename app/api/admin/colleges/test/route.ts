import { adminRoute, body } from "@/lib/route";
import { read } from "@/lib/store";
import { evaluateSignup } from "@/lib/college";

// Dry run: never writes anything.
export const POST = adminRoute(["colleges","view"] as const, async (req) => {
  const b = await body<{ email: string; verified: boolean; code?: string }>(req);
  return evaluateSignup(await read(), String(b.email || ""), !!b.verified, b.code);
});
