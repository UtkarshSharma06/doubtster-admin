import { hookRoute } from "@/lib/hook";
import { registerSignup } from "@/lib/service";

/*
  Called by your signup handler right after the account is created.
  Body: { email, name?, verified?, code?, country?, source?, device?, lang? }
  Returns the credits to give. Safe to retry: one college grant per email, ever.
*/
export const POST = hookRoute(async (b) =>
  registerSignup({
    email: String(b.email || ""), name: b.name ? String(b.name) : undefined, verified: !!b.verified, code: b.code ? String(b.code) : undefined,
    country: b.country ? String(b.country) : undefined, source: b.source ? String(b.source) : undefined,
    device: b.device ? String(b.device) : undefined, lang: b.lang ? String(b.lang) : undefined,
  }),
);
