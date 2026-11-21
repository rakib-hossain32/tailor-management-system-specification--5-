import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "রহমান টেইলার্স — টেইলর ম্যানেজমেন্ট সিস্টেম",
    template: "%s · রহমান টেইলার্স",
  },
  description:
    "কাস্টমার, মাপ, অর্ডার, কাজ বণ্টন, মজুরি, পেমেন্ট ও কাপড়ের স্টক — সবকিছু এক জায়গায়। মাপ নিতে দোকানে আসুন, অর্ডার অনলাইনে ট্র্যাক করুন।",
  keywords: ["টেইলর", "tailor", "মাপ", "measurement", "অর্ডার", "ঢাকা"],
};

const fontLinks = [
  "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Tiro+Bangla:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {fontLinks.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
