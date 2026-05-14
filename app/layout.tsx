import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { brand } from "@/lib/branding";
import { appUrl } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: brand.appName,
    template: `%s | ${brand.appName}`
  },
  description: brand.tagline,
  metadataBase: new URL(appUrl),
  icons: {
    icon: brand.logoPath,
    shortcut: brand.logoPath,
    apple: brand.logoPath
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
