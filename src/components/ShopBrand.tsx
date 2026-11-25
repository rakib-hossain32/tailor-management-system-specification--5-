"use client";

import Image from "next/image";
import { Logo } from "@/components/Logo";
import { useShop } from "@/components/ShopContext";

export function ShopLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const shop = useShop();
  return shop.logoUrl ? (
    <Image src={shop.logoUrl} alt={shop.nameBn || shop.nameEn || "লোগো"} width={size} height={size} sizes={`${size}px`} className={`object-contain ${className}`} />
  ) : <Logo size={size} className={className} label={shop.nameBn || shop.nameEn || "লোগো"} />;
}

export function ShopName() {
  const shop = useShop();
  return <>{shop.nameBn || shop.nameEn}</>;
}

export function ShopContactLine({ className = "" }: { className?: string }) {
  const shop = useShop();
  return shop.phone ? <a href={`tel:${shop.phone}`} className={className}>{shop.phone}</a> : null;
}

export function ShopPrintDetails({ footer = false }: { footer?: boolean }) {
  const shop = useShop();
  return <span className="whitespace-pre-line">{footer ? shop.invoiceFooter : [shop.address, shop.phone, shop.email].filter(Boolean).join(" · ")}</span>;
}
