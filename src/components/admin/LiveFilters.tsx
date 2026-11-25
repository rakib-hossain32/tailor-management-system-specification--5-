"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/DateField";

/**
 * Instant admin filters — the panel-wide standard. Typing in a search
 * box or picking a dropdown updates the URL query right away
 * (debounced for text) and the server page re-renders with the new
 * results. There is NO "খুঁজুন / ফিল্টার করুন" submit button: the
 * result changes as the admin types or selects.
 *
 * Each control receives the page's current params via `params` so one
 * control never wipes another's filter; changing any filter resets
 * pagination to page 1.
 */

type Params = Record<string, string>;

function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  return (next: Params) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ""));
    const qs = new URLSearchParams(clean).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

export function LiveSearchInput({
  param = "q",
  value,
  params,
  placeholder,
  id,
  className,
}: {
  param?: string;
  value: string;
  params: Params;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const [text, setText] = useState(value);
  const stateRef = useRef({ params, navigate });
  useEffect(() => {
    stateRef.current = { params, navigate };
  });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const { params: current, navigate: go } = stateRef.current;
      const next: Params = { ...current, page: "1" };
      if (text.trim()) next[param] = text.trim();
      else delete next[param];
      go(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, param]);

  return (
    <Input
      id={id}
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}

export function LiveSelectFilter({
  param,
  value,
  params,
  options,
  ariaLabel,
  className,
  placeholder,
}: {
  param: string;
  /** Current value; "all" (or "") means no filter. */
  value: string;
  params: Params;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => {
        const next: Params = { ...params, page: "1" };
        if (v && v !== "all") next[param] = v;
        else delete next[param];
        navigate(next);
      }}
    >
      <SelectTrigger aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LiveDateFilter({
  param = "from",
  value,
  params,
  placeholder,
  className,
}: {
  param?: string;
  value: string;
  params: Params;
  placeholder?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <DateField
      name={param}
      defaultValue={value || undefined}
      placeholder={placeholder}
      className={className}
      onChange={(iso) => {
        const next: Params = { ...params, page: "1" };
        if (iso) next[param] = iso;
        else delete next[param];
        navigate(next);
      }}
    />
  );
}
