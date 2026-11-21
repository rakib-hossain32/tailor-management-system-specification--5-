"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Renders the on-screen card to an exact-size PDF (90 mm wide — the width of
 * an adult's index finger, i.e. a pocket card) and downloads it directly.
 * No preview, no print dialog: one click → file saved.
 */
export function AppointmentPdfButton({
  targetId,
  fileName,
  label = "PDF ডাউনলোড করুন",
  widthMm = 90,
  autoStart = false,
  className,
}: {
  targetId: string;
  fileName: string;
  label?: string;
  widthMm?: number;
  autoStart?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ?dl=1 → the file starts downloading as soon as the card is on screen
  useEffect(() => {
    if (!autoStart) return;
    const t = setTimeout(() => void download(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const el = document.getElementById(targetId);
      if (!el) throw new Error("card-not-found");

      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const canvas = await html2canvas(el as HTMLElement, {
        scale: 3,
        backgroundColor: "#FFFCF6",
        useCORS: true,
        logging: false,
      });

      const pageW = widthMm;
      const pageH = Math.max(
        45,
        Math.round(((canvas.height * widthMm) / canvas.width) * 10) / 10,
      );

      const pdf = new jsPDF({
        unit: "mm",
        format: [pageW, pageH],
        orientation: "portrait",
        compress: true,
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH, undefined, "FAST");
      pdf.save(fileName);
    } catch {
      setError("PDF তৈরি করা যায়নি — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-block">
      <Button type="button" variant="gold" onClick={download} disabled={busy} className={className}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {busy ? "তৈরি হচ্ছে…" : label}
      </Button>
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-chalk">
          <FileWarning className="size-3.5" />
          {error}
        </span>
      )}
    </span>
  );
}
