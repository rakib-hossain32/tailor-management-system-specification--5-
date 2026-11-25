import Image from "next/image";

/**
 * Full-bleed cinematic backdrop — the photograph IS the hero. A very
 * slow, subtle zoom (Ken Burns) keeps it alive without motion sickness;
 * layered ink gradients guarantee text contrast top and bottom.
 * Reduced-motion users get a still image (globals.css).
 */
export function HeroBackdrop({ image, alt }: { image: string | null; alt: string }) {
  return (
    <div className="absolute inset-0" aria-hidden={image ? undefined : true}>
      {image ? (
        <Image
          src={image}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="hero-zoom object-cover"
        />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(120%_120%_at_20%_0%,#22314d_0%,#0f1a2c_55%,#0a1220_100%)]" />
      )}
      {/* legibility gradients — stronger at the bottom where copy sits */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/55 via-transparent to-transparent" />
    </div>
  );
}
