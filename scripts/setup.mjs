import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { projectRoot, loadProjectEnv } from "./lib/env.mjs";

const localEnv = join(projectRoot, ".env.local");
if (!existsSync(localEnv)) {
  const port = process.env.LOCAL_DB_PORT || "5432";
  const password = randomBytes(18).toString("hex");
  writeFileSync(localEnv, [
    "# Generated local configuration. The existing cloud .env is preserved.",
    `DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:${port}/app_db`,
    `AUTH_SECRET=${randomBytes(32).toString("hex")}`,
    "LOCAL_DEMO_MODE=true",
    `LOCAL_DB_PORT=${port}`,
    "",
  ].join("\n"), { mode: 0o600, flag: "wx" });
  console.log("Created .env.local with a random database password and session secret.");
}
loadProjectEnv();
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("setup only initializes local databases. Configure a localhost DATABASE_URL in .env.local; your cloud DB will not be changed.");
}

async function run(script, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(projectRoot, script), ...args], {
      cwd: projectRoot, env: process.env, windowsHide: true, stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${script} failed (exit ${code}).`)));
  });
}

await run("scripts/local-db.mjs", ["start"]);
await run("node_modules/drizzle-kit/bin.cjs", ["migrate", "--config=drizzle.config.ts"]);
await run("scripts/seed.mjs");
console.log("\nSetup complete. Run npm run dev and open http://localhost:3000");
console.log("Admin: admin@rahimantailors.com / admin123");
console.log("Worker: worker@rahimantailors.com / worker123");
