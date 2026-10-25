import { guard } from "@/lib/guard";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { read } from "@/lib/store";
import EditorLoader from "@/components/views/EditorLoader";

export const metadata: Metadata = { title: "Edit post" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await guard("blog");
  const { id } = await params;
  const d = await read();
  const post = d.posts.find((p) => p.id === id);
  if (!post) notFound();
  return <EditorLoader post={post} site={d.site} otherSlugs={d.posts.filter((p) => p.id !== id).map((p) => p.slug)} />;
}
