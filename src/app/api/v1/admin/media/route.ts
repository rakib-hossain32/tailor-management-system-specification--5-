import { NextResponse } from "next/server";
import { adminRoute, ApiError } from "@/lib/api-route";
import { requireOwnerOrManager } from "@/lib/access";
import { listMedia, uploadMedia } from "@/server/media/service";
export const GET = adminRoute(async () => {
  await requireOwnerOrManager();
  return NextResponse.json({ data: await listMedia() });
});
export const POST = adminRoute(async (req, _ctx, actor) => {
  await requireOwnerOrManager();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "VALIDATION_ERROR", "ছবি নির্বাচন করুন");
  if (file.size > 12 * 1024 * 1024) throw new ApiError(413, "IMAGE_TOO_LARGE", "ছবি সর্বোচ্চ ১২ MB হতে পারে");
  const data = await uploadMedia(Buffer.from(await file.arrayBuffer()), file.name, actor, {
    key: typeof form.get("key") === "string" ? String(form.get("key")) : undefined,
    altText: typeof form.get("altText") === "string" ? String(form.get("altText")) : undefined,
    assetId: typeof form.get("assetId") === "string" ? String(form.get("assetId")) : undefined,
  });
  return NextResponse.json({ data }, { status: data.reused ? 200 : 201 });
});
