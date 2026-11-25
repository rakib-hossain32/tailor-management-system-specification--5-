import "server-only";
import type { PublicShop, PublicSiteSnapshot } from "./types";
import type { loadPublicSiteData } from "./repository";

type PublicSiteData = Awaited<ReturnType<typeof loadPublicSiteData>>;

function toPublicImageUrl(asset: PublicSiteData["assets"][number] | undefined) {
  if (!asset) return null;
  if (asset.secureUrl) return asset.secureUrl;
  // Keep the checked-in source image visible until the Cloudinary sync runs.
  return asset.originalFileName
    ? "/images/" + encodeURIComponent(asset.originalFileName)
    : null;
}

function presentShop(data: PublicSiteData): PublicShop {
  const source = data.shop;
  const assets = new Map(data.assets.map((asset) => [asset.id, asset]));
  const imageUrl = (id: string | null | undefined) =>
    id ? toPublicImageUrl(assets.get(id)) : null;

  return {
    nameBn: source?.nameBn ?? "",
    nameEn: source?.nameEn ?? "",
    tagline: source?.tagline ?? "",
    address: source?.address ?? "",
    phone: source?.phone ?? "",
    email: source?.email ?? "",
    whatsapp: source?.whatsapp ?? "",
    facebookUrl: source?.facebookUrl ?? "",
    foundedYear: source?.foundedYear ?? null,
    invoiceFooter: source?.invoiceFooter ?? "",
    logoUrl: imageUrl(source?.logoAssetId),
    heroUrl: imageUrl(source?.heroAssetId),
    aboutUrl: imageUrl(source?.aboutAssetId),
    timezone: source?.timezone ?? "Asia/Dhaka",
    currency: source?.currency ?? "BDT",
    hours: data.hours.map(
      ({ weekday, closed, opensAtMinute, closesAtMinute, slotMinutes }) => ({
        weekday,
        closed,
        opensAtMinute,
        closesAtMinute,
        slotMinutes,
      }),
    ),
  };
}

function presentPages(data: PublicSiteData, imageUrl: (id: string | null) => string | null) {
  const sectionsByPage = new Map<string, PublicSiteData["sections"]>();
  for (const row of data.sections) {
    const entries = sectionsByPage.get(row.section.pageSlug) ?? [];
    entries.push(row);
    sectionsByPage.set(row.section.pageSlug, entries);
  }

  return Object.fromEntries(
    data.pages.map((page) => [
      page.slug,
      {
        slug: page.slug,
        title: page.title,
        intro: page.intro,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        sections: (sectionsByPage.get(page.slug) ?? []).map(
          ({ section, personName }) => ({
            id: section.id,
            kind: section.kind,
            heading: section.heading,
            body: section.body,
            subtitle: section.subtitle,
            label: section.label,
            position: section.position,
            imageUrl: imageUrl(section.mediaAssetId),
            personName,
            data: section.data,
          }),
        ),
      },
    ]),
  );
}

function presentGarments(data: PublicSiteData, imageUrl: (id: string | null) => string | null) {
  const details = new Map(
    data.serviceDetails.map((detail) => [detail.garmentTypeId, detail]),
  );

  return data.garments.map((garment) => {
    const detail = details.get(garment.id);
    return {
      id: garment.id,
      code: garment.code,
      nameBn: garment.nameBn,
      nameEn: garment.nameEn,
      category: garment.category,
      basePrice: garment.basePrice,
      defaultDeliveryDays: garment.defaultDeliveryDays,
      defaultFabricEstimate: garment.defaultFabricEstimate,
      summary: detail?.summary ?? "",
      features: detail?.features ?? [],
      imageUrl: imageUrl(detail?.mediaAssetId ?? null),
      featured: detail?.featured ?? false,
    };
  });
}

function presentGallery(data: PublicSiteData, imageUrl: (id: string | null) => string | null) {
  return data.gallery.flatMap((entry) => {
    const url = imageUrl(entry.mediaAssetId);
    return url
      ? [
          {
            id: entry.id,
            title: entry.title,
            caption: entry.caption,
            category: entry.category,
            imageUrl: url,
          },
        ]
      : [];
  });
}

export function toPublicSiteSnapshot(data: PublicSiteData): PublicSiteSnapshot {
  const assets = new Map(data.assets.map((asset) => [asset.id, asset]));
  const imageUrl = (id: string | null) => (id ? toPublicImageUrl(assets.get(id)) : null);
  const shop = presentShop(data);

  return {
    shop,
    pages: presentPages(data, imageUrl),
    garments: presentGarments(data, imageUrl),
    gallery: presentGallery(data, imageUrl),
    stats: {
      customers: data.customerCount,
      measurements: data.measurementCount,
      deliveredOrders: data.deliveredOrderCount,
      todayOrders: data.todayOrderCount,
      workers: data.workerCount,
      years: shop.foundedYear
        ? Math.max(0, new Date().getFullYear() - shop.foundedYear)
        : null,
    },
  };
}
