import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { toPublicSiteSnapshot } from "./presenter";
import { loadPublicSiteData } from "./repository";
import type { PublicSiteSnapshot } from "./types";

export type { PublicSiteSnapshot } from "./types";

/** Read editable public content at request time, then present it to the pages. */
export const getPublicSiteSnapshot = cache(
  async (): Promise<PublicSiteSnapshot> => {
    await connection();
    return toPublicSiteSnapshot(await loadPublicSiteData());
  },
);
