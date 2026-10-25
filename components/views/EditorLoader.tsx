"use client";
import dynamic from "next/dynamic";
import type { Post, Site } from "@/lib/types";

// The editor measures text in pixels with a canvas, so it only renders in the browser.
const Editor = dynamic(() => import("./Editor"), { ssr: false, loading: () => <p className="help">Loading editor...</p> });

export default function EditorLoader(props: { post: Post; site: Site; otherSlugs: string[] }) {
  return <Editor {...props} />;
}
