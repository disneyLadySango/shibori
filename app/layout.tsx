import type { Metadata } from "next";
import { Noto_Sans_JP, Shippori_Mincho } from "next/font/google";

import "./globals.css";

const sans = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-sans" });
const mincho = Shippori_Mincho({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-mincho" });

export const metadata: Metadata = {
  title: "シボリ — 学びたいを、次のひとつに",
  description: "複数の学習目的・到達状態・理解状態から、いま集中する一つを提案する学習支援プロダクト",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body className={`${sans.variable} ${mincho.variable}`}>{children}</body></html>;
}
