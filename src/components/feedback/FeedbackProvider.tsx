"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";

export interface MutationFeedback { ok: boolean; text: string; title?: string }

export function useMutationFeedback(initial: MutationFeedback | null = null) {
  const [feedback, setFeedback] = useState(initial);
  const update = useCallback((value: MutationFeedback | null) => {
    setFeedback(value);
    if (value) {
      const notify = value.ok ? toast.success : toast.error;
      notify(value.title ?? value.text, { description: value.title ? value.text : undefined });
    }
  }, []);
  return [feedback, update] as const;
}

export function useMutationError() {
  const [error, setError] = useState<string | null>(null);
  const update = useCallback((value: string | null) => {
    setError(value);
    if (value) toast.error(value);
  }, []);
  return [error, update] as const;
}

export function FeedbackToaster() {
  return <Toaster richColors closeButton position="top-right" toastOptions={{ className: "font-sans" }} />;
}

export function UrlFeedbackBridge() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const url = new URL(window.location.href);
    const ok = url.searchParams.get("ok");
    const error = url.searchParams.get("error");
    if (!ok && !error) return;
    url.searchParams.delete("ok");
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (error) toast.error(error);
    else if (ok) toast.success(ok === "1" || /^[a-z_-]+$/i.test(ok) ? "পরিবর্তন সংরক্ষিত হয়েছে।" : ok);
  }, [pathname, search]);
  return null;
}
