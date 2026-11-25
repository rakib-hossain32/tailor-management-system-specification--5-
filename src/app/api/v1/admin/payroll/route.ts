import { adminRoute } from "@/lib/api-route";
import { buildPayrollPdf } from "@/server/pdf/payroll";
import { pdfResponse } from "@/server/pdf/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Payroll sheet as a real server-generated PDF download. */
export const GET = adminRoute(async () => pdfResponse(await buildPayrollPdf(), "পেরোল তৈরি করা যায়নি"));
