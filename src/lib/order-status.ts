/**
 * Order status state machine (PRD section 7).
 * All status changes MUST go through canTransition() — UI hiding is not enough.
 */

export type OrderStatusCode =
  | "draft"
  | "requested"
  | "confirmed"
  | "cutting"
  | "stitching"
  | "finishing"
  | "trial_ready"
  | "alteration"
  | "ready"
  | "delivered"
  | "cancelled"
  | "on_hold";

export interface StatusMeta {
  code: OrderStatusCode;
  labelBn: string;
  customerLabel: string;
  /** short helper shown in the admin list */
  hintBn: string;
  /** hex tokens used by StatusBadge — always paired with an icon + text */
  fg: string;
  bg: string;
  icon: string;
}

export const ORDER_STATUSES: StatusMeta[] = [
  { code: "draft", labelBn: "খসড়া", customerLabel: "", hintBn: "অর্ডার তৈরি হচ্ছে", fg: "#5B6472", bg: "#ECE7DE", icon: "✎" },
  { code: "requested", labelBn: "অনুরোধ", customerLabel: "অনুরোধ গৃহীত", hintBn: "অনলাইন অনুরোধ, যাচাই বাকি", fg: "#7A5C12", bg: "#F6E3B8", icon: "◷" },
  { code: "confirmed", labelBn: "অর্ডার প্রাপ্ত", customerLabel: "অর্ডার নিশ্চিত", hintBn: "নিশ্চিত, কাজ শুরুর অপেক্ষায়", fg: "#1B4F8F", bg: "#DCE9F8", icon: "✓" },
  { code: "cutting", labelBn: "কাটিং", customerLabel: "কাজ চলছে", hintBn: "কাপড় কাটা হচ্ছে", fg: "#7A5C12", bg: "#FBEFC8", icon: "✂" },
  { code: "stitching", labelBn: "সেলাই", customerLabel: "কাজ চলছে", hintBn: "সেলাই চলছে", fg: "#8A4B08", bg: "#FCE4CC", icon: "◍" },
  { code: "finishing", labelBn: "ফিনিশিং", customerLabel: "কাজ চলছে", hintBn: "বোতাম/ইস্ত্রি/শেষ কাজ", fg: "#5B3A94", bg: "#EAE2F8", icon: "✧" },
  { code: "trial_ready", labelBn: "ট্রায়াল প্রস্তুত", customerLabel: "ট্রায়ালের জন্য আসুন", hintBn: "কাস্টমারকে ট্রায়ালে ডাকা হয়েছে", fg: "#8A4B08", bg: "#FCE4CC", icon: "◈" },
  { code: "alteration", labelBn: "সংশোধন", customerLabel: "সংশোধন চলছে", hintBn: "ট্রায়ালের পর পরিবর্তন", fg: "#5B3A94", bg: "#EAE2F8", icon: "↻" },
  { code: "ready", labelBn: "রেডি", customerLabel: "তৈরি, নিতে আসুন", hintBn: "ডেলিভারির জন্য প্রস্তুত", fg: "#1D6B3F", bg: "#D9F0E1", icon: "★" },
  { code: "delivered", labelBn: "ডেলিভারড", customerLabel: "ডেলিভারি সম্পন্ন", hintBn: "কাস্টমার নিয়েছে", fg: "#3F4A3F", bg: "#E3E7E0", icon: "▣" },
  { code: "on_hold", labelBn: "স্থগিত", customerLabel: "স্থগিত", hintBn: "কাপড়/কাস্টমার অনুপস্থিত", fg: "#7A5C12", bg: "#F6E3B8", icon: "⏸" },
  { code: "cancelled", labelBn: "বাতিল", customerLabel: "বাতিল", hintBn: "কারণসহ বাতিল", fg: "#8E2C22", bg: "#F8DEDA", icon: "✕" },
];

export const STATUS_MAP: Record<string, StatusMeta> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.code, s]),
);

export function statusMeta(code: string): StatusMeta {
  return (
    STATUS_MAP[code] ?? {
      code: "draft",
      labelBn: code,
      customerLabel: code,
      hintBn: "",
      fg: "#5B6472",
      bg: "#ECE7DE",
      icon: "•",
    }
  );
}

/** Allowed transitions — PRD 7.2. `on_hold` returns to the previous active status. */
export const TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  draft: ["confirmed"],
  requested: ["confirmed", "cancelled"],
  confirmed: ["cutting", "on_hold", "cancelled"],
  cutting: ["stitching", "on_hold", "cancelled"],
  stitching: ["finishing", "on_hold"],
  finishing: ["trial_ready", "ready", "on_hold"],
  trial_ready: ["alteration", "ready"],
  alteration: ["trial_ready", "ready"],
  ready: ["delivered"],
  on_hold: ["confirmed", "cutting", "stitching", "finishing", "trial_ready", "alteration", "ready", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as OrderStatusCode];
  if (!allowed) return false;
  return allowed.includes(to as OrderStatusCode);
}

/** Which statuses can be reached right now (for the action bar). */
export function nextStatuses(from: string): OrderStatusCode[] {
  return TRANSITIONS[from as OrderStatusCode] ?? [];
}

/** Public tracking: coarse 4-step progress, never leaking internal stages. */
export const PUBLIC_STEPS = ["অর্ডার নিশ্চিত", "কাজ চলছে", "ট্রায়াল/রেডি", "ডেলিভারি"];

const PUBLIC_STEP_OF: Record<string, number> = {
  draft: -1,
  requested: 0,
  confirmed: 0,
  cutting: 1,
  stitching: 1,
  finishing: 1,
  trial_ready: 2,
  alteration: 2,
  ready: 2,
  delivered: 3,
  on_hold: 1,
  cancelled: -1,
};

export function publicProgress(status: string): number {
  return PUBLIC_STEP_OF[status] ?? 0;
}

export function isOverdue(status: string, deliveryDate: string | Date): boolean {
  if (status === "delivered" || status === "cancelled") return false;
  const due = typeof deliveryDate === "string" ? new Date(deliveryDate + "T00:00:00") : deliveryDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Statuses that count as "work in progress" for the board / dashboard. */
export const ACTIVE_STATUSES: OrderStatusCode[] = [
  "confirmed",
  "cutting",
  "stitching",
  "finishing",
  "trial_ready",
  "alteration",
  "ready",
  "on_hold",
  "requested",
  "draft",
];
