import type { Metadata } from "next";
import { Noto_Sans_JP, Shippori_Mincho } from "next/font/google";

import "./globals.css";

const sans = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-sans" });
const mincho = Shippori_Mincho({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-mincho" });

export const metadata: Metadata = {
  title: "シボリ — 集中のポートフォリオマネージャー",
  description: "教材を、耳で聴く講義と机で解く一問に絞る学習支援プロダクト",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body className={`${sans.variable} ${mincho.variable}`}>{children}</body></html>;
}
