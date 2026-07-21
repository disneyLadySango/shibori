import type { Metadata } from "next";
import { Noto_Sans_JP, Shippori_Mincho } from "next/font/google";

import "./globals.css";

const sans = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-sans" });
const mincho = Shippori_Mincho({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-mincho" });

export const metadata: Metadata = {
  title: "Shibori — One thing worth your focus",
  description: "A focus portfolio for learning that turns your purposes, target states, and current understanding into one next focus.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mincho.variable}`}>{children}</body></html>;
}
