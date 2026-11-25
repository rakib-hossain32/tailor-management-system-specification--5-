export type PublicShop = {
  nameBn: string; nameEn: string; tagline: string; address: string; phone: string;
  email: string; whatsapp: string; facebookUrl: string; foundedYear: number | null;
  invoiceFooter: string; logoUrl: string | null; heroUrl: string | null; aboutUrl: string | null;
  timezone: string; currency: string; hours: Array<{ weekday: number; closed: boolean; opensAtMinute: number; closesAtMinute: number; slotMinutes: number }>;
};
export type PublicSection = {
  id: string; kind: string; heading: string; body: string; subtitle: string; label: string;
  position: number; imageUrl: string | null; personName: string | null;
};
export type PublicSitePage = {
  slug: string; title: string; intro: string; seoTitle: string; seoDescription: string; sections: PublicSection[];
};
export type PublicGarment = {
  id: string; code: string; nameBn: string; nameEn: string; category: string; basePrice: string;
  defaultDeliveryDays: number; defaultFabricEstimate: string | null; summary: string;
  features: string[]; imageUrl: string | null; featured: boolean;
};
export type PublicSiteSnapshot = {
  shop: PublicShop;
  pages: Record<string, PublicSitePage>;
  garments: PublicGarment[];
  gallery: Array<{ id: string; title: string; caption: string; category: string; imageUrl: string }>;
  stats: { customers: number; measurements: number; deliveredOrders: number; workers: number; todayOrders: number; years: number | null };
};
