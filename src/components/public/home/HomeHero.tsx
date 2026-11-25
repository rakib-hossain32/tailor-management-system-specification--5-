import type { PublicGarment, PublicSection, PublicShop } from "@/server/cms/types";
import { asList, asRecord } from "./content";
import { HeroBackdrop } from "./hero/HeroBackdrop";
import { HeroOverlay } from "./hero/HeroOverlay";

/**
 * Hero — full-bleed cinematic cover. The shop photograph fills the
 * entire first screen edge to edge; the copy is set over it like a
 * fashion-house masthead. Deliberately NOT the split layout (text one
 * side, picture the other) and no floating dashboard cards — that
 * pattern is a decade old. Mobile first: full-viewport height, copy
 * anchored to the bottom, actions full-width.
 * Composed from the modules in ./hero — nothing else lives here.
 */
export function HomeHero({ section, title, intro, shop }: {
  section?: PublicSection;
  title: string;
  intro: string;
  shop: PublicShop;
  garments?: PublicGarment[];
}) {
  const data = asRecord(section?.data);
  const promises = asList(data.promises).map(asRecord);
  const heading = section?.heading || title;
  const image = section?.imageUrl || shop.heroUrl;

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-paper">
      <HeroBackdrop image={image} alt={heading} />
      <HeroOverlay
        label={section?.label || section?.subtitle || shop.nameEn}
        heading={heading}
        body={section?.body || intro}
        promises={promises}
      />
    </section>
  );
}
