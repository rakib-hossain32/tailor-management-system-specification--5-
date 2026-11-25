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
  // Three typefaces, by the owner's decision:
  //  - Hind Siliguri — all writing (headings, body, labels, UI).
  //  - Tiro Bangla — every displayed number (.num): Bengali digits,
  //    dates, prices, measurements, phone numbers.
  //  - IBM Plex Mono — English/Latin data only (.code): order numbers
  //    and other Latin alphanumeric codes.
  "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Tiro+Bangla:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
];

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { shop } = await getPublicSiteSnapshot();
  return (
    <html lang="bn" data-scroll-behavior="smooth" suppressHydrationWarning>
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
      {/* suppressHydrationWarning: browser extensions inject attributes
          (e.g. __processed_*) into <body> before React loads — that is not
          a site bug, and this keeps the console clean of false warnings. */}
      <body className="antialiased" suppressHydrationWarning>
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
