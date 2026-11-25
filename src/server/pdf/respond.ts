import { NextResponse } from "next/server";

/**
 * Turn a built PDF into a direct-download response — the response
 * itself is the file (Content-Disposition: attachment). No preview
 * page, no print dialog. Shared by every admin PDF route.
 */
export function pdfResponse(
  result: { buffer: Buffer; fileName: string } | null,
  notFoundMessage: string,
): NextResponse {
  if (!result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: notFoundMessage } },
      { status: 404 },
    );
  }
  // HTTP headers are ByteStrings: a Bengali file name (e.g. a
  // measurement card named after the customer) must travel in the
  // RFC 5987 filename* parameter, with an ASCII fallback alongside.
  const asciiName = result.fileName.replace(/[^\x20-\x7E]/g, "-").replace(/"/g, "");
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      "content-length": String(result.buffer.length),
      "cache-control": "private, no-store",
    },
  });
}
