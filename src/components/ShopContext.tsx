"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicSiteSnapshot } from "@/server/cms/types";

export type ShopData = PublicSiteSnapshot["shop"];
const ShopContext = createContext<ShopData | null>(null);

export function ShopProvider({ shop, children }: { shop: ShopData; children: ReactNode }) {
  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const shop = useContext(ShopContext);
  if (!shop) throw new Error("ShopProvider is required");
  return shop;
}
