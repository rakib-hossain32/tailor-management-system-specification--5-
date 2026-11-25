import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

/**
 * Demo / dummy accounts for local testing ONLY.
 *
 *   npm run db:demo-accounts
 *
 * Creates (idempotently — safe to run again):
 *   • a demo ADMIN  (owner role)  → full dashboard access
 *   • a demo WORKER (worker role) → worker task screens
 *
 * Passwords are reset on every run, so the credentials below always work.
 * NEVER run this against a production database, and delete the accounts
 * (Admin Panel → ব্যবহারকারী) before the shop goes live.
 */
export const DEMO_ACCOUNTS = [
  {
    kind: "admin" as const,
    name: "ডেমো অ্যাডমিন",
    email: "admin@tailorpro.demo",
    password: "Admin@12345",
    phone: "+8801700000001",
    role: "owner",
  },
  {
    kind: "worker" as const,
    name: "ডেমো ওয়ার্কার",
    email: "worker@tailorpro.demo",
    password: "Worker@12345",
    phone: "+8801700000002",
    role: "worker",
  },
];

async function main() {
  const { db, pool } = await import("../src/db/index");
  const schema = await import("../src/db/schema");
  const { hashPassword } = await import("../src/lib/auth");
  const { resolvePerson } = await import("../src/server/repositories/people");

  try {
    const summary = await db.transaction(async (tx) => {
      const results: Array<{ kind: string; email: string; created: boolean }> = [];
      for (const account of DEMO_ACCOUNTS) {
        const person = await resolvePerson(tx, {
          name: account.name,
          email: account.email,
          phone: account.phone,
        });
        const [existing] = await tx
          .select()
          .from(schema.userAccounts)
          .where(eq(schema.userAccounts.personId, person.id))
          .limit(1);
        if (existing) {
          await tx
            .update(schema.userAccounts)
            .set({ role: account.role, passwordHash: hashPassword(account.password), isActive: true, updatedAt: new Date() })
            .where(eq(schema.userAccounts.id, existing.id));
        } else {
          await tx.insert(schema.userAccounts).values({
            personId: person.id,
            role: account.role,
            passwordHash: hashPassword(account.password),
            isActive: true,
          });
        }
        if (account.kind === "worker") {
          const [worker] = await tx
            .select()
            .from(schema.workerProfiles)
            .where(eq(schema.workerProfiles.personId, person.id))
            .limit(1);
          if (!worker) {
            await tx.insert(schema.workerProfiles).values({
              personId: person.id,
              role: "stitching",
              payType: "piece_rate",
              skillTags: ["ডেমো"],
              isActive: true,
            });
          } else if (!worker.isActive) {
            await tx
              .update(schema.workerProfiles)
              .set({ isActive: true, updatedAt: new Date() })
              .where(eq(schema.workerProfiles.id, worker.id));
          }
        }
        results.push({ kind: account.kind, email: account.email, created: !existing });
      }
      return results;
    });

    console.log("Demo accounts ready (login: http://localhost:3000/staff-login)");
    for (const account of DEMO_ACCOUNTS) {
      const row = summary.find((item) => item.kind === account.kind);
      console.log(
        `  ${account.kind === "admin" ? "ADMIN " : "WORKER"}  ${account.email}  /  ${account.password}  (${row?.created ? "created" : "password reset"})`,
      );
    }
    console.log("Local testing only — delete these accounts before going live.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Demo account setup failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
