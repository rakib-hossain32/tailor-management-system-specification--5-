import { config } from "dotenv";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });
async function initialize() {
const { db, pool } = await import("../src/db/index");
const schema = await import("../src/db/schema");
const { hashPassword } = await import("../src/lib/auth");
const { resolvePerson } = await import("../src/server/repositories/people");
const credentialPath = resolve(".local/admin-credentials.json");
const catalog = JSON.parse(readFileSync(resolve("scripts/data/catalog.json"), "utf8")) as {
  garments: Array<{ code: string; nameBn: string; nameEn: string; category: string; measurementSchema: unknown; styleSchema: unknown;
    basePrice: string; defaultDeliveryDays: number; defaultFabricEstimate: string | null; sortOrder: number;
    stageRates: Record<string, string> }>;
};
const adminEmail = (process.env.ADMIN_EMAIL || "admin@tailorpro.local").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
const titles: Record<string, string> = { home: "মাপ ও পোশাক সেবা", about: "আমাদের সম্পর্কে", services: "সেবা ও মূল্য",
  gallery: "গ্যালারি", contact: "যোগাযোগ", "how-it-works": "কীভাবে কাজ করে", terms: "শর্তাবলি", privacy: "গোপনীয়তা" };

try {
  let createdAdmin = false;
  const summary = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tailorpro_initialize'))`);
    const initialized = await tx.select({ key: schema.settings.key }).from(schema.settings).where(eq(schema.settings.key, "initialization")).limit(1);
    let [admin] = await tx.select().from(schema.userAccounts).where(eq(schema.userAccounts.role, "owner")).limit(1);
    if (!admin) {
      const person = await resolvePerson(tx, { name: process.env.ADMIN_NAME || "Administrator", email: adminEmail });
      const existingAccount = await tx.select().from(schema.userAccounts).where(eq(schema.userAccounts.personId, person.id)).limit(1);
      if (existingAccount.length) throw new Error("ADMIN_EMAIL already belongs to another account. Configure a different admin email.");
      [admin] = await tx.insert(schema.userAccounts).values({ personId: person.id, role: "owner", passwordHash: hashPassword(adminPassword), isActive: true }).returning();
      createdAdmin = true;
    }
    for (const [position, definition] of catalog.garments.entries()) {
      let [garment] = await tx.select().from(schema.garmentCatalog).where(eq(schema.garmentCatalog.code, definition.code)).limit(1);
      if (!garment) {
        [garment] = await tx.insert(schema.garmentCatalog).values({
          code: definition.code, nameBn: definition.nameBn, nameEn: definition.nameEn, category: definition.category,
          basePrice: String(definition.basePrice), defaultDeliveryDays: definition.defaultDeliveryDays,
          defaultFabricEstimate: definition.defaultFabricEstimate == null ? null : String(definition.defaultFabricEstimate),
          sortOrder: definition.sortOrder ?? position, isActive: false,
        }).returning();
        const [version] = await tx.insert(schema.garmentSchemaVersions).values({
          garmentTypeId: garment.id, version: 1, measurementSchema: definition.measurementSchema,
          styleSchema: definition.styleSchema, createdByUserId: admin.id,
        }).returning();
        await tx.update(schema.garmentCatalog).set({ activeSchemaVersionId: version.id, isActive: true }).where(eq(schema.garmentCatalog.id, garment.id));
        for (const [stage, pieceRate] of Object.entries(definition.stageRates)) {
          await tx.insert(schema.garmentStageRates).values({ garmentTypeId: garment.id, stage, version: 1, pieceRate: String(pieceRate), createdByUserId: admin.id });
        }
      }
      await tx.insert(schema.serviceDetails).values({ garmentTypeId: garment.id, featured: true, updatedBy: admin.id }).onConflictDoNothing();
    }
    await tx.insert(schema.shopSettings).values({ id: 1, nameBn: process.env.SHOP_NAME || "TailorPro", nameEn: process.env.SHOP_NAME || "TailorPro", updatedBy: admin.id }).onConflictDoNothing();
    for (let weekday = 0; weekday < 7; weekday++) {
      await tx.insert(schema.shopHours).values({ shopId: 1, weekday, closed: weekday === 5, opensAtMinute: 600, closesAtMinute: 1260, slotMinutes: 30 }).onConflictDoNothing();
    }
    for (const [slug, title] of Object.entries(titles)) {
      await tx.insert(schema.sitePages).values({ slug, title, updatedBy: admin.id }).onConflictDoNothing();
    }
    let registeredImages = 0;
    const directory = resolve("public/images");
    if (!initialized.length && existsSync(directory)) for (const fileName of readdirSync(directory).filter((file) => /\.(png|jpe?g|webp)$/i.test(file))) {
      const buffer = readFileSync(resolve(directory, fileName));
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const key = fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      let [asset] = await tx.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.sha256, checksum)).limit(1);
      if (!asset) [asset] = await tx.insert(schema.mediaAssets).values({ key, sha256: checksum, originalFileName: fileName, bytes: buffer.length, status: "pending", createdBy: admin.id }).returning();
      if (key === "hero-cutting-table") await tx.update(schema.shopSettings).set({ heroAssetId: asset.id }).where(and(eq(schema.shopSettings.id, 1), isNull(schema.shopSettings.heroAssetId)));
      if (key === "trial-fitting") await tx.update(schema.shopSettings).set({ aboutAssetId: asset.id }).where(and(eq(schema.shopSettings.id, 1), isNull(schema.shopSettings.aboutAssetId)));
      await tx.insert(schema.galleryEntries).values({ mediaAssetId: asset.id, title: key.replaceAll("-", " "), position: registeredImages, createdBy: admin.id }).onConflictDoNothing();
      registeredImages++;
    }
    await tx.insert(schema.settings).values({ key: "initialization", value: { version: 1 } }).onConflictDoNothing();
    return { adminCreated: createdAdmin, serviceDefinitions: catalog.garments.length, imageReferences: registeredImages, demoBusinessRecordsInserted: 0 };
  });
  if (createdAdmin) {
    mkdirSync(resolve(".local"), { recursive: true });
    writeFileSync(credentialPath, JSON.stringify({ email: adminEmail, password: adminPassword, login: "http://localhost:3000/staff-login" }, null, 2) + "\n", { mode: 0o600 });
  }
  console.log(JSON.stringify(summary));
  if (createdAdmin) console.log("Administrator credentials saved privately in .local/admin-credentials.json");
} finally { await pool.end(); }
}
initialize().catch((error: unknown) => {
  console.error("Initialization failed:", error instanceof Error && !("query" in error) ? error.message : "Check the database configuration and constraints.");
  process.exitCode = 1;
});
