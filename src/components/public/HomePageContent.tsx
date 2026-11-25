import type { PublicSiteSnapshot } from "@/server/cms/types";
import { headerFor, homeSections } from "./home/content";
import { HomeBenefits } from "./home/HomeBenefits";
import { HomeHero } from "./home/HomeHero";
import { HomeProcess } from "./home/HomeProcess";
import { HomeServices } from "./home/HomeServices";
import { HomeStats } from "./home/HomeStats";
import { HomeTestimonials } from "./home/HomeTestimonials";
import { HomeTracking } from "./home/HomeTracking";
import { HomeVisitCTA } from "./home/HomeVisitCTA";

export function HomePageContent({ snapshot }: { snapshot: PublicSiteSnapshot }) {
  const page = snapshot.pages.home;
  const sections = page?.sections ?? [];
  return <>
    <HomeHero section={homeSections(sections, "hero")[0]} title={page?.title || snapshot.shop.nameBn} intro={page?.intro || snapshot.shop.tagline} shop={snapshot.shop} />
    <HomeStats sections={homeSections(sections, "statistic")} />
    <HomeTracking section={homeSections(sections, "tracking")[0]} />
    <HomeBenefits heading={headerFor(sections, "benefits")} sections={homeSections(sections, "benefit")} />
    <HomeServices heading={headerFor(sections, "services")} sections={homeSections(sections, "service")} />
    <HomeProcess heading={headerFor(sections, "process")} sections={homeSections(sections, "process")} />
    <HomeTestimonials heading={headerFor(sections, "testimonials")} sections={homeSections(sections, "testimonial")} />
    <HomeVisitCTA section={homeSections(sections, "cta")[0]} shop={snapshot.shop} />
  </>;
}
