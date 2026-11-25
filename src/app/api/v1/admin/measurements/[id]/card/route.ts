import { adminRoute } from "@/lib/api-route";
import { buildMeasurementCardPdf } from "@/server/pdf/measurement-card";
import { pdfResponse } from "@/server/pdf/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** Measurement card as a real server-generated PDF download. */
export const GET = adminRoute(async (_request, context: Context) => {
  const { id } = await context.params;
  return pdfResponse(await buildMeasurementCardPdf(id), "মাপ পাওয়া যায়নি");
});
