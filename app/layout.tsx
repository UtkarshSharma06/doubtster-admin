import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./admin.css";

const inter = localFont({
  src: [
    { path: "./fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
const caveat = localFont({
  src: [{ path: "./fonts/Caveat-Variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
  fallback: ["cursive"],
});

export const metadata: Metadata = {
  title: { default: "Doubtster Admin", template: "%s | Doubtster Admin" },
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: "/brand/doubtster-icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F4F4F5" }, { media: "(prefers-color-scheme: dark)", color: "#0E0F13" }],
};

// Applies the saved theme before paint, so there is no flash.
const themeScript = `try{var t=localStorage.getItem('dt_theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
