import { adminRoute, csvResponse } from "@/lib/route";
import { read } from "@/lib/store";

export const GET = adminRoute(["audit","edit"] as const, async () => {
  const d = await read();
  return csvResponse("doubtster-audit", [["time", "type", "action", "target", "detail", "by"], ...d.audit.map((a) => [a.t, a.type, a.action, a.target, a.detail, a.by])]);
});
