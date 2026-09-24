import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/env";

import "./globals.css";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Application privée : pas d'indexation tant qu'un vrai site public n'existe pas.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f8f6f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={siteConfig.locale} className={`${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
