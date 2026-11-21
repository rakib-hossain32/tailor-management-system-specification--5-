"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";
import { ScanLine, Camera, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function resolveQrTarget(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  // absolute or relative URL
  if (/^https?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      if (u.pathname.startsWith("/admin/") || u.pathname.startsWith("/book/")) {
        return `${u.pathname}${u.search}`;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (text.startsWith("/admin/") || text.startsWith("/book/")) return text;

  // order number → search the order list
  if (/^TP-\d{4}-\d{4}$/i.test(text)) return `/admin/orders?q=${text.toUpperCase()}`;

  // bare uuid → try the customer hub
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    return `/admin/customers/${text}`;
  }
  return null;
}

/**
 * Camera QR scanner for the admin panel.
 * Accepts:
 *  - any same-site URL   → opened directly (customer / order / measurement page)
 *  - an order number      → TP-2611-0042 → order list search
 *  - a plain uuid/path    → best-effort navigation
 * Also offers a paste-box so the camera is never a hard requirement.
 */
export function QrScanner({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const regionId = "tailorpro-qr-region";
  const busyRef = useRef(false);

  const goTo = useCallback((target: string) => {
    setOpen(false);
    router.push(target);
    router.refresh();
  }, [router]);

  const onScan = useCallback((text: string) => {
    if (busyRef.current) return;
    const target = resolveQrTarget(text);
    if (!target) {
      setLastCode(text.slice(0, 120));
      setError("এই কোড চিনতে পারিনি — অনুগ্রহ করে অর্ডার নম্বর বা লিংক দিয়ে খুঁজুন।");
      return;
    }
    busyRef.current = true;
    setLastCode(text.slice(0, 120));
    goTo(target);
  }, [goTo]);

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setError(null);
      setLastCode(null);
    }
    setOpen(nextOpen);
  }

  // start / stop the camera with the dialog
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    async function stopScanner() {
      if (!scanner) return;
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        /* camera already stopped */
      }
    }

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(regionId, { verbose: false });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            if (!cancelled) onScan(decoded);
          },
          () => /* per-frame decode miss */ undefined,
        );
        if (cancelled) await stopScanner();
      } catch (err) {
        if (cancelled) return;
        setError(
          "ক্যামেরা চালু করা যায়নি — অনুমতি দিন অথবা নিচে কোড/অর্ডার নম্বর লিখে খুঁজুন।",
        );
        void err;
      }
    })();

    return () => {
      cancelled = true;
      if (scanner?.isScanning) void stopScanner();
      busyRef.current = false;
    };
  }, [open, onScan]);

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => changeOpen(true)}>
        <ScanLine className="size-4 text-gold-dark" />
        QR স্ক্যান
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[92vh] w-[94vw] max-w-md overflow-y-auto overflow-x-hidden p-0">
          <DialogHeader className="border-b border-ink/12 px-5 pb-3.5 pt-5">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-5 text-gold-dark" />
              QR স্ক্যান করুন
            </DialogTitle>
            <DialogDescription>
              কাস্টমার কার্ড বা মাপ কার্ডের QR ক্যামেরার সামনে ধরুন — সরাসরি সেই কাস্টমার বা অর্ডারের
              পাতায় যাওয়া হবে।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 pb-5">
            <div className="relative overflow-hidden rounded-md border border-ink/15 bg-ink">
              <div id={regionId} className="min-h-[240px] w-full" />
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <span className="size-56 rounded-lg border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(15,26,44,0.35)]" />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>স্ক্যান করা যায়নি</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {lastCode && !error && (
              <Alert variant="success">
                <AlertDescription>কোড পাওয়া গেছে: {lastCode}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="qr-manual">ক্যামেরা না থাকলে — অর্ডার নম্বর / লিংক</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-manual"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="TP-2611-0042 বা /admin/customers/…"
                  className="num"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const t = resolveQrTarget(manual);
                    if (!t) setError("সঠিক অর্ডার নম্বর বা /admin/… লিংক দিন");
                    else goTo(t);
                  }}
                >
                  যান
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3 text-[13.5px] text-stone">
              <span>স্ক্যান হলে স্বয়ংক্রিয়ভাবে খুলবে</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                <X className="size-4" />
                বন্ধ করুন
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
