import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { ShopProvider } from "@/components/ShopContext";
import {
  FeedbackToaster,
  UrlFeedbackBridge,
} from "@/components/feedback/FeedbackProvider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { shop } = await getPublicSiteSnapshot();
  const name = shop.nameBn || shop.nameEn || "টেইলর ব্যবস্থাপনা";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: shop.tagline || undefined,
  };
}

const fontLinks = [
  "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Tiro+Bangla:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
];

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { shop } = await getPublicSiteSnapshot();
  return (
    <html lang="bn" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {fontLinks.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="antialiased">
        <ShopProvider shop={shop}>
          {children}
          <FeedbackToaster />
          <Suspense fallback={null}>
            <UrlFeedbackBridge />
          </Suspense>
        </ShopProvider>
      </body>
    </html>
  );
}
