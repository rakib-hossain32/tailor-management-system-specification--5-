/**
 * Tolerant garment matching for booking preselection.
 *
 * Service cards link to /book?garment=<text>, where the text may be a
 * catalog name ("পাঞ্জাবি"), a code-resolved name, or a marketing
 * heading ("রাজকীয় পাঞ্জাবি ও কুর্তা"). Exact string equality is too
 * brittle for that — this matcher tries, in order:
 *   1. exact match (after whitespace normalization)
 *   2. the garment name appearing inside the incoming text
 *   3. the incoming text appearing inside a garment name
 * and returns the catalog name to preselect, or null when nothing fits
 * (callers then link to the plain booking page instead of passing a
 * name that can never select anything).
 */
export type GarmentLike = { nameBn: string };

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/");
}

export function matchGarmentName(input: string, garments: GarmentLike[]): string | null {
  const needle = normalize(input);
  if (!needle) return null;
  const byName = new Map(garments.map((g) => [normalize(g.nameBn), g.nameBn]));
  const exact = byName.get(needle);
  if (exact) return exact;
  // Longest catalog name contained in the text wins, so "প্যান্ট/ট্রাউজার"
  // beats a shorter overlapping name.
  let best: string | null = null;
  for (const [normalizedName, nameBn] of byName) {
    if (normalizedName.length >= 2 && needle.includes(normalizedName)) {
      if (!best || normalizedName.length > normalize(best).length) best = nameBn;
    }
  }
  if (best) return best;
  for (const [normalizedName, nameBn] of byName) {
    if (needle.length >= 2 && normalizedName.includes(needle)) return nameBn;
  }
  return null;
}
