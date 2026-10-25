import { NextResponse, type NextRequest } from "next/server";
import { expireCredits } from "@/lib/service";
import { createHash, timingSafeEqual } from "crypto";

// Called once a day by Vercel cron or by your own cron.
// Accepts Authorization: Bearer <HOOK_SECRET> or Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const h = (x: string) => createHash("sha256").update(x).digest();
  const hookSecret = process.env.HOOK_SECRET || "";
  const cronSecret = process.env.CRON_SECRET || process.env.HOOK_SECRET || "";

  const validHook = hookSecret.length >= 32 && timingSafeEqual(h(got), h(hookSecret));
  const validCron = cronSecret.length >= 32 && timingSafeEqual(h(got), h(cronSecret));

  if (!validHook && !validCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await expireCredits();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[expire-credits]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
