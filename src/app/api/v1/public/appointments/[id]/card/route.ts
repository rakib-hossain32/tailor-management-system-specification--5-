import { NextResponse } from "next/server";
import { headers } from "next/headers";
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
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const result = await buildAppointmentCardPdf(id, `${proto}://${host}`);
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
