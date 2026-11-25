import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { buildAppointmentCardPdf } from "@/server/pdf/appointment-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Direct PDF download — the response itself is the file
 * (Content-Disposition: attachment). No preview page, no print dialog.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await buildAppointmentCardPdf(id);
    if (!result) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "অ্যাপয়েন্টমেন্ট পাওয়া যায়নি" } },
        { status: 404 },
      );
    }
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${result.fileName}"`,
        "content-length": String(result.buffer.length),
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
