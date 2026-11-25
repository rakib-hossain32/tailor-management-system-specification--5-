import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { eq } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });
async function synchronizeMedia() {
const { cloudinaryConfigured, uploadMedia } = await import("../src/server/media/service");
if (!cloudinaryConfigured()) {
  console.error("Cloudinary upload is waiting for real credentials. Replace placeholders in .env and retry npm run media:sync.");
  process.exit(1);
}
const { db, pool } = await import("../src/db/index");
const { users } = await import("../src/db/schema");
const { mediaAssets } = await import("../src/db/content-schema");
try {
  const [owner] = await db.select().from(users).where(eq(users.role, "owner")).limit(1);
  if (!owner?.isActive) throw new Error("Initialize an active owner account first.");
  const actor = { id: owner.id, userId: owner.id, name: owner.name, role: owner.role, workerId: null, expiresAt: Number.MAX_SAFE_INTEGER };
  const pending = await db.select().from(mediaAssets).where(eq(mediaAssets.status, "pending"));
  const directory = resolve("public/images");
  let uploaded = 0;
  for (const asset of pending) {
    const path = resolve(directory, basename(asset.originalFileName));
    if (!path.startsWith(directory + sep)) throw new Error("Invalid source image path.");
    await uploadMedia(readFileSync(path), asset.originalFileName, actor, { key: asset.key, altText: asset.altText, assetId: asset.id });
    uploaded++;
  }
  console.log(JSON.stringify({ uploaded, referencesSavedIn: "PostgreSQL", duplicatesPreventedBy: "sha256 unique constraint" }));
} finally { await pool.end(); }
}
synchronizeMedia().catch(() => {
  console.error("Media synchronization failed. Check Cloudinary credentials, image files and the database.");
  process.exitCode = 1;
});
