import type { Metadata } from "next";
import AuthFrame from "@/components/AuthFrame";
import InviteForm from "@/components/InviteForm";
import { inviteInfo } from "@/lib/admins";

export const metadata: Metadata = { title: "Set up admin access", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await inviteInfo(token);
  if (!info) {
    return (
      <AuthFrame>
        <h1>This link does not work</h1>
        <p className="help">It has expired or was already used. Ask your super admin to send a new one.</p>
        <p><a className="btn" href="/admin/login">Go to sign in</a></p>
      </AuthFrame>
    );
  }
  return <InviteForm token={token} info={info} />;
}
