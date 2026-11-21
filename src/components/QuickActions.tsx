"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircleIcon } from "lucide-react";

const ITEMS: { href: string; label: string; hint: string }[] = [
  { href: "/admin/orders/new", label: "নতুন অর্ডার", hint: "কাস্টমার → পোশাক → মাপ" },
  { href: "/admin/customers/new", label: "নতুন কাস্টমার", hint: "নাম ও ফোন" },
  { href: "/admin/customers", label: "মাপ নিন", hint: "কাস্টমার বেছে মাপ নেওয়া" },
  { href: "/admin/payments", label: "পেমেন্ট / বকেয়া", hint: "আয় ও বকেয়া" },
  { href: "/admin/expenses", label: "খরচ এন্ট্রি", hint: "দৈনন্দিন খরচ" },
  { href: "/admin/appointments", label: "অ্যাপয়েন্টমেন্ট", hint: "স্লট বুকিং" },
];

export function QuickActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="gold" size="lg">
          <PlusCircleIcon />
          দ্রুত কাজ
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>যেকোনো পাতা থেকে</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((it, i) => (
          <DropdownMenuItem key={it.href} asChild>
            <Link href={it.href} className="cursor-pointer">
              <span className="flex flex-col">
                <span className="font-medium">{it.label}</span>
                <span className="text-[13px] text-stone">{it.hint}</span>
              </span>
              <DropdownMenuShortcut>{i + 1}</DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
