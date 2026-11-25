"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";
import { ScanBarcode, Camera, X } from "lucide-react";
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
import { digitsOnly } from "@/lib/barcode";

/**
 * Camera BARCODE scanner for staff (admin + worker).
 *
 * Printed cards carry a Code128 barcode with only a 12-digit record
 * number — no URL, no QR. This scanner reads 1D barcodes only (QR
 * support is deliberately off), resolves the number through the
 * staff-only /api/v1/staff/by-code endpoint, and opens the record:
 * appointments land on the role-aware /scan/<id> page, customer codes
 * (measurement cards, admins only) open the customer hub. A typed
 * order number (TP-…) still jumps to the order list, and the manual
 * box accepts the barcode number typed from the card — the camera is
 * never a hard requirement.
 */
export interface BarcodeHit {
  type: "appointment" | "customer";
  id: string;
  customerId?: string | null;
}

export function BarcodeScanner({
  className,
  onResolve,
}: {
  className?: string;
  /**
   * Embed mode (e.g. the New Order wizard): instead of navigating to
   * the record, hand the resolved hit to the caller — an appointment
   * hit also carries its customerId so a form can load that customer.
   */
  onResolve?: (hit: BarcodeHit) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const regionId = "tailorpro-barcode-region";
  const busyRef = useRef(false);

  const goTo = useCallback((target: string) => {
    setOpen(false);
    router.push(target);
    router.refresh();
  }, [router]);

  const resolveAndGo = useCallback(async (raw: string) => {
    const text = (raw ?? "").trim();
    if (!text || busyRef.current) return;

    // Order number → order list search (navigation mode only).
    if (!onResolve && /^TP-\d{4}-\d{4}$/i.test(text)) {
      busyRef.current = true;
      goTo(`/admin/orders?q=${text.toUpperCase()}`);
      return;
    }
    // A pasted staff path still works from the manual box.
    if (text.startsWith("/admin/") || text.startsWith("/scan/")) {
      busyRef.current = true;
      goTo(text);
      return;
    }
    // Barcode number → staff-only resolution endpoint.
    const digits = digitsOnly(text);
    if (digits.length === 12) {
      busyRef.current = true;
      setLastCode(digits);
      try {
        const res = await fetch(`/api/v1/staff/by-code?code=${digits}`);
        const body = await res.json().catch(() => null);
        if (res.ok && body?.data?.id) {
          if (onResolve) {
            busyRef.current = false;
            setOpen(false);
            onResolve(body.data as BarcodeHit);
            return;
          }
          goTo(body.data.type === "customer" ? `/admin/customers/${body.data.id}` : `/scan/${body.data.id}`);
          return;
        }
        setError(body?.error?.message ?? "এই নম্বরে কোনো রেকর্ড পাওয়া যায়নি।");
      } catch {
        setError("সার্ভারে যোগাযোগ করা যায়নি — আবার চেষ্টা করুন।");
      }
      busyRef.current = false;
      return;
    }
    setLastCode(text.slice(0, 120));
    setError("এই কোড চিনতে পারিনি — বারকোডের ১২ ডিজিটের নম্বর বা অর্ডার নম্বর দিন।");
  }, [goTo, onResolve]);

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
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
          ],
        });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 120 } },
          (decoded) => {
            if (!cancelled) void resolveAndGo(decoded);
          },
          () => /* per-frame decode miss */ undefined,
        );
        if (cancelled) await stopScanner();
      } catch (err) {
        if (cancelled) return;
        setError(
          "ক্যামেরা চালু করা যায়নি — অনুমতি দিন অথবা নিচে বারকোডের নম্বর লিখে খুঁজুন।",
        );
        void err;
      }
    })();

    return () => {
      cancelled = true;
      if (scanner?.isScanning) void stopScanner();
      busyRef.current = false;
    };
  }, [open, resolveAndGo ]);

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => changeOpen(true)}>
        <ScanBarcode className="size-4 text-gold-dark" />
        বারকোড স্ক্যান
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[92vh] w-[94vw] max-w-md overflow-y-auto overflow-x-hidden p-0">
          <DialogHeader className="border-b border-ink/12 px-5 pb-3.5 pt-5">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-5 text-gold-dark" />
              বারকোড স্ক্যান করুন
            </DialogTitle>
            <DialogDescription>
              অ্যাপয়েন্টমেন্ট কার্ড বা মাপ কার্ডের বারকোড ক্যামেরার সামনে ধরুন — সেই
              অ্যাপয়েন্টমেন্ট বা কাস্টমারের রেকর্ড সরাসরি খুলে যাবে।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 pb-5">
            <div className="relative overflow-hidden rounded-md border border-ink/15 bg-ink">
              <div id={regionId} className="min-h-[240px] w-full" />
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <span className="h-28 w-72 max-w-[85%] rounded-lg border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(15,26,44,0.35)]" />
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
              <Label htmlFor="barcode-manual">ক্যামেরা না থাকলে — বারকোডের নম্বর / অর্ডার নম্বর</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode-manual"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="1234 5678 9012 বা TP-2611-0042"
                  className="code"
                />
                <Button
                  type="button"
                  onClick={() => void resolveAndGo(manual)}
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
