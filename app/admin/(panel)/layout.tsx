import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { currentCtx } from "@/lib/route";
import { read } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentCtx();
  if (!ctx) redirect("/admin/login");
  const d = await read();
  const badges = {
    payments: d.payments.filter((p) => p.status === "failed").length,
    videos: d.jobs.filter((j) => j.status === "queued" || j.status === "rendering").length,
    colleges: d.colleges.filter((c) => c.active).length,
    admins: d.admins.filter((a) => a.status === "invited").length,
  };
  const em = d.flags.emergency;
  const alerts = [em.stopVideo && "Video generation is stopped", em.stopCheckout && "Checkout is paused", em.readOnly && "The app is in read-only mode", d.flags.maintenance && "Maintenance mode is on"].filter(Boolean) as string[];
  return (
    <Shell
      me={{ name: ctx.admin.name, email: ctx.admin.email, role: ctx.admin.role, twoFactor: !!ctx.admin.totpSecret }}
      perms={ctx.perms}
      locked={ctx.mustSetup2fa}
      siteUrl={d.site.url}
      badges={badges}
      alerts={alerts}
    >
      {children}
    </Shell>
  );
}
