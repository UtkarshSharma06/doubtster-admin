import { hookRoute } from "@/lib/hook";
import { markEmailVerified } from "@/lib/service";

// Called by your email verification handler. Body: { email }
export const POST = hookRoute(async (b) => markEmailVerified(String(b.email || "")));
