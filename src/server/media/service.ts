import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { galleryEntries, mediaAssets, serviceDetails, shopSettings, siteSections } from "@/db/content-schema";
import { ApiError, isUuid } from "@/lib/api-route";
import { recordAudit } from "@/server/audit";
import type { StaffSession } from "@/lib/access";

const MAX_BYTES = 12 * 1024 * 1024;
const KEY = /^[a-z0-9][a-z0-9_-]{1,79}$/;

export function cloudinaryConfigured() {
  const url = process.env.CLOUDINARY_URL;
  if (url && !/YOUR_|REPLACE_|example/i.test(url)) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "cloudinary:" && Boolean(parsed.username && parsed.password && parsed.hostname);
    } catch { return false; }
  }
  return ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
    .every((key) => Boolean(process.env[key]) && !/YOUR_|REPLACE_|example/i.test(process.env[key]!));
}

function configureCloudinary() {
  if (!cloudinaryConfigured()) throw new ApiError(503, "CLOUDINARY_NOT_CONFIGURED", "Cloudinary-এর সঠিক keys env file-এ বসিয়ে app restart করুন");
  if (process.env.CLOUDINARY_URL) {
    const parsed = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({ cloud_name: parsed.hostname, api_key: decodeURIComponent(parsed.username), api_secret: decodeURIComponent(parsed.password), secure: true });
  } else {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

function imageMime(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  throw new ApiError(415, "UNSUPPORTED_IMAGE", "PNG, JPEG অথবা WebP ছবি দিন");
}

function dto(asset: typeof mediaAssets.$inferSelect) {
  return { id: asset.id, key: asset.key, status: asset.status, url: asset.secureUrl,
    cloudinaryPublicId: asset.cloudinaryPublicId, originalFileName: asset.originalFileName,
    width: asset.width, height: asset.height, bytes: asset.bytes, format: asset.format, altText: asset.altText };
}

export async function listMedia() {
  const assets = await db.select().from(mediaAssets).where(ne(mediaAssets.status, "archived"));
  return { configured: cloudinaryConfigured(), assets: assets.map(dto) };
}

/** Deduplicate pixels by checksum; every page references the one resulting asset ID. */
export async function uploadMedia(buffer: Buffer, fileName: string, actor: StaffSession, options: { key?: string; altText?: string; assetId?: string } = {}) {
  if (!["owner", "manager"].includes(actor.role)) throw new ApiError(403, "FORBIDDEN", "ছবি আপলোডের অনুমতি নেই");
  if (!buffer.length || buffer.length > MAX_BYTES) throw new ApiError(413, "IMAGE_TOO_LARGE", "ছবি সর্বোচ্চ ১২ MB হতে পারে");
  const mime = imageMime(buffer);
  const key = options.key ?? "asset-" + randomUUID();
  if (!KEY.test(key) || (options.assetId && !isUuid(options.assetId)) || (options.altText?.length ?? 0) > 500) throw new ApiError(400, "VALIDATION_ERROR", "ছবির পরিচয় বা বর্ণনা সঠিক নয়");
  const originalFileName = fileName.split(/[\\/]/).pop()?.slice(0, 200) || "image";
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const [same] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.sha256, checksum), eq(mediaAssets.status, "ready"))).limit(1);
  if (same) return { ...dto(same), reused: true };
  configureCloudinary();
  let uploadedId: string | null = null;
  let oldId: string | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"media:" + checksum}))`);
      const [duplicate] = await tx.select().from(mediaAssets).where(and(eq(mediaAssets.sha256, checksum), eq(mediaAssets.status, "ready"))).limit(1);
      if (duplicate) return duplicate;
      const [target] = options.assetId
        ? await tx.select().from(mediaAssets).where(eq(mediaAssets.id, options.assetId)).for("update")
        : await tx.select().from(mediaAssets).where(or(eq(mediaAssets.key, key), eq(mediaAssets.sha256, checksum))).limit(1);
      if (options.assetId && !target) throw new ApiError(404, "NOT_FOUND", "ছবি পাওয়া যায়নি");
      const uploaded = await cloudinary.uploader.upload("data:" + mime + ";base64," + buffer.toString("base64"), {
        resource_type: "image", public_id: "tailorpro/assets/" + randomUUID(), overwrite: false, timeout: 30000,
      });
      uploadedId = uploaded.public_id;
      oldId = target?.cloudinaryPublicId ?? null;
      const values = { sha256: checksum, cloudinaryPublicId: uploaded.public_id, secureUrl: uploaded.secure_url,
        originalFileName, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, format: uploaded.format,
        altText: options.altText ?? target?.altText ?? "", status: "ready", updatedAt: new Date() };
      const [saved] = target
        ? await tx.update(mediaAssets).set(values).where(eq(mediaAssets.id, target.id)).returning()
        : await tx.insert(mediaAssets).values({ ...values, key, createdBy: actor.userId }).returning();
      await recordAudit(tx, { actorId: actor.userId, action: target ? "replace" : "create", entity: "media", entityId: saved.id, details: { checksum } });
      return saved;
    });
    if (oldId && oldId !== uploadedId) {
      try { await cloudinary.uploader.destroy(oldId, { invalidate: true }); }
      catch { console.warn("Replaced Cloudinary asset requires later cleanup"); }
    }
    return { ...dto(result), reused: !uploadedId };
  } catch (error) {
    if (uploadedId) {
      try { await cloudinary.uploader.destroy(uploadedId); } catch { console.warn("Uncommitted Cloudinary asset requires cleanup"); }
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "IMAGE_UPLOAD_FAILED", "ছবি upload হয়নি — Cloudinary configuration যাচাই করুন");
  }
}

export async function updateMedia(id: string, body: { altText?: string }, actor: StaffSession) {
  if (!isUuid(id) || typeof body.altText !== "string" || body.altText.length > 500) throw new ApiError(400, "VALIDATION_ERROR", "ছবির বর্ণনা সঠিক নয়");
  return db.transaction(async (tx) => {
    const [row] = await tx.update(mediaAssets).set({ altText: body.altText, updatedAt: new Date() }).where(eq(mediaAssets.id, id)).returning();
    if (!row) throw new ApiError(404, "NOT_FOUND", "ছবি পাওয়া যায়নি");
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "media", entityId: id, details: { changedFields: ["altText"] } });
    return dto(row);
  });
}

export async function deleteMedia(id: string, actor: StaffSession) {
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "ছবির পরিচয় সঠিক নয়");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
    if (!row) throw new ApiError(404, "NOT_FOUND", "ছবি পাওয়া যায়নি");
    const references = await Promise.all([
      tx.select({ id: galleryEntries.id }).from(galleryEntries).where(eq(galleryEntries.mediaAssetId, id)).limit(1),
      tx.select({ id: siteSections.id }).from(siteSections).where(eq(siteSections.mediaAssetId, id)).limit(1),
      tx.select({ id: serviceDetails.garmentTypeId }).from(serviceDetails).where(eq(serviceDetails.mediaAssetId, id)).limit(1),
      tx.select({ id: shopSettings.id }).from(shopSettings).where(or(eq(shopSettings.logoAssetId, id), eq(shopSettings.heroAssetId, id), eq(shopSettings.aboutAssetId, id))).limit(1),
    ]);
    if (references.some((rows) => rows.length)) throw new ApiError(409, "MEDIA_IN_USE", "এই ছবি সাইটে ব্যবহৃত হচ্ছে — আগে তার reference সরান");
    if (row.cloudinaryPublicId) {
      configureCloudinary();
      try { await cloudinary.uploader.destroy(row.cloudinaryPublicId, { invalidate: true }); }
      catch { throw new ApiError(502, "IMAGE_DELETE_FAILED", "Cloudinary থেকে ছবি মুছতে সমস্যা হয়েছে"); }
    }
    await tx.update(mediaAssets).set({ status: "archived", updatedAt: new Date() }).where(eq(mediaAssets.id, id));
    await recordAudit(tx, { actorId: actor.userId, action: "archive", entity: "media", entityId: id });
    return { ok: true };
  });
}
