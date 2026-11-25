"use client";

import Link from "next/link";
import { useShop } from "@/components/ShopContext";
import { ShopLogo } from "@/components/ShopBrand";

const LINKS: [string, string][] = [["/services", "সার্ভিস ও মূল্য"], ["/gallery", "গ্যালারি"], ["/about", "আমাদের সম্পর্কে"], ["/contact", "যোগাযোগ"], ["/how-it-works", "কীভাবে কাজ করে"]];
const CUSTOMER: [string, string][] = [["/track", "অর্ডার ট্র্যাকিং"], ["/book", "অ্যাপয়েন্টমেন্ট"], ["/login", "কাস্টমার পোর্টাল"], ["/terms", "শর্তাবলি"], ["/privacy", "গোপনীয়তা"]];

/**
 * Footer — deliberately has NO appointment button: the call-to-action
 * section directly above the footer owns that job, so the two never
 * duplicate each other. On mobile the two link groups sit side by side
 * in two columns; brand and contact stack above/below them.
 */
export function SiteFooter() {
  const shop = useShop();
  return (
    <footer className="no-print border-t border-gold/30 bg-ink text-paper">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-9 lg:grid-cols-[1.3fr_2fr_1fr] lg:gap-12">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <ShopLogo size={28} />
              </span>
              <div className="min-w-0">
                <div className="truncate font-display text-[22px]">{shop.nameBn || shop.nameEn}</div>
                <div className="smallcaps text-[10px] text-gold">{shop.nameEn}</div>
              </div>
            </div>
            {shop.tagline && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-paper/75">{shop.tagline}</p>}
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {shop.facebookUrl && <a href={shop.facebookUrl} className="text-paper/80 hover:text-white">ফেসবুক</a>}
              {shop.whatsapp && <a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}`} className="text-paper/80 hover:text-white">WhatsApp</a>}
              {shop.email && <a href={`mailto:${shop.email}`} className="text-paper/80 hover:text-white">ইমেইল</a>}
            </div>
          </div>

          {/* link groups — two columns on mobile, side by side on desktop too */}
          <div className="grid grid-cols-2 gap-6 sm:gap-9">
            {[["তথ্য ও সেবা", LINKS], ["কাস্টমার পরিষেবা", CUSTOMER]].map(([title, entries]) => (
              <nav key={title as string} aria-label={title as string}>
                <h2 className="smallcaps mb-4 text-gold">{title as string}</h2>
                <ul className="space-y-2.5">
                  {(entries as [string, string][]).map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} className="text-[14.5px] leading-snug text-paper/80 hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div>
            <h2 className="smallcaps mb-4 text-gold">যোগাযোগ</h2>
            {shop.address && (
              <address className="whitespace-pre-line text-[14.5px] not-italic leading-relaxed text-paper/80">
                {shop.address}
              </address>
            )}
            {shop.phone && (
              <a href={`tel:${shop.phone}`} className="num mt-3 block text-gold">
                {shop.phone}
              </a>
            )}
            {shop.email && (
              <a href={`mailto:${shop.email}`} className="mt-2 block break-all text-sm text-paper/80 hover:text-white">
                {shop.email}
              </a>
            )}
            <p className="mt-4 text-[13px] leading-relaxed text-paper/55">
              অ্যাপয়েন্টমেন্টের জন্য উপরের “অ্যাপয়েন্টমেন্ট নিন” বাটনটি ব্যবহার করুন।
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-paper/60">
        © {new Date().getFullYear()} {shop.nameBn || shop.nameEn}
        <Link href="/staff-login" className="ml-5 text-gold">
          স্টাফ লগইন
        </Link>
      </div>
    </footer>
  );
}
