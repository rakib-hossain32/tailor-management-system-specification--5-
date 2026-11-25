"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A table row that navigates when ANY part of it is clicked — admins
 * shouldn't have to aim for one small link per row. Clicks that start
 * on a link, button or form control inside the row keep their own
 * behavior and never trigger the row navigation.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  function onClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest("a,button,input,select,textarea,label,[role='button']")) return;
    router.push(href);
  }
  return (
    <TableRow onClick={onClick} className={cn("cursor-pointer", className)}>
      {children}
    </TableRow>
  );
}
