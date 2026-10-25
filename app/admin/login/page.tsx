import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { currentCtx } from "@/lib/route";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentCtx()) redirect("/admin");
  const { next } = await searchParams;
  const safe = next && /^\/admin(\/[a-z0-9\-/]*)?$/.test(next) ? next : "/admin";
  return <LoginForm next={safe} />;
}
