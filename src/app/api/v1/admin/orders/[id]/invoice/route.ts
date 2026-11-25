import { adminRoute } from "@/lib/api-route";
import { buildInvoicePdf } from "@/server/pdf/invoice";
import { pdfResponse } from "@/server/pdf/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** Cash memo / invoice as a real server-generated PDF download. */
export const GET = adminRoute(async (_request, context: Context) => {
  const { id } = await context.params;
  return pdfResponse(await buildInvoicePdf(id), "অর্ডার পাওয়া যায়নি");
});
