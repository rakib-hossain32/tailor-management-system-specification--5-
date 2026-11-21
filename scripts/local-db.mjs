import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { platform, arch } from "node:os";
import { spawn } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { loadProjectEnv, projectRoot } from "./lib/env.mjs";

loadProjectEnv();
const command = process.argv[2] ?? "status";
const storage = join(projectRoot, ".local");
const dataDir = join(storage, "postgres");
const logFile = join(storage, "postgres.log");
const url = new URL(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db");
if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.username || !url.password) {
  throw new Error("DATABASE_URL must be a PostgreSQL URL with a username, password and database.");
}
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("db:start manages a local database only. Run npm run setup to create .env.local; your cloud .env is preserved.");
}
const port = Number(url.port || 5432);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local database port.");
const binaryPlatform = platform() === "win32" ? "windows" : platform();
const binaries = await import(`@embedded-postgres/${binaryPlatform}-${arch()}`);
const pgCtl = join(dirname(binaries.postgres), platform() === "win32" ? "pg_ctl.exe" : "pg_ctl");

function run(args, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(pgCtl, args, { cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      // pg_ctl can leave inherited pipe handles open in its server child on Windows.
      child.stdout.destroy();
      child.stderr.destroy();
      if (code === 0 || allowFailure) resolve({ code, output });
      else reject(new Error(output.trim() || `pg_ctl exited with ${code}. See .local/postgres.log.`));
    });
  });
}

async function status() {
  if (!existsSync(join(dataDir, "PG_VERSION"))) return false;
  return (await run(["-D", dataDir, "status"], true)).code === 0;
}

if (command === "stop") {
  if (await status()) {
    await run(["-D", dataDir, "-m", "fast", "-w", "stop"]);
    console.log("Local PostgreSQL stopped. Your data is preserved in .local/postgres.");
  } else console.log("Local PostgreSQL is already stopped.");
} else if (command === "status") {
  console.log(await status() ? `Local PostgreSQL is running on 127.0.0.1:${port}.` : "Local PostgreSQL is stopped. Run npm run db:start.");
} else if (command === "start") {
  mkdirSync(storage, { recursive: true });
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      port,
      authMethod: "scram-sha-256",
      persistent: true,
      autoRehydrateSymlinks: true,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      onLog: () => {},
      onError: (error) => console.error(String(error)),
    });
    console.log("Creating the local PostgreSQL cluster…");
    await database.initialise();
    appendFileSync(join(dataDir, "postgresql.conf"), "\n# TailorPro local development\nlisten_addresses = '127.0.0.1'\ntimezone = 'Asia/Dhaka'\n");
  }
  if (!await status()) {
    await run(["-D", dataDir, "-l", logFile, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  }
  // Confirm that this cluster serves the configured port before creating a DB.
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const directory = await client.query("SHOW data_directory");
    const normalize = (value) => value.replaceAll("\\", "/").toLowerCase();
    if (normalize(directory.rows[0].data_directory) !== normalize(dataDir)) {
      throw new Error("The configured port belongs to another PostgreSQL cluster. Choose another port in .env.local.");
    }
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (!databaseName) throw new Error("DATABASE_URL must include a database name.");
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (existing.rowCount === 0) await client.query(`CREATE DATABASE ${client.escapeIdentifier(databaseName)}`);
    console.log(`Local PostgreSQL is ready on 127.0.0.1:${port}/${databaseName}.`);
  } finally { await client.end(); }
  if (process.argv.includes("--foreground")) {
    // Keep the launcher alive in managed terminals that clean up child jobs.
    console.log("PostgreSQL is attached to this terminal. Keep it open; Ctrl+C stops the database.");
    const heartbeat = setInterval(() => {}, 30_000);
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      try {
        if (await status()) await run(["-D", dataDir, "-m", "fast", "-w", "stop"]);
      } finally {
        clearInterval(heartbeat);
        process.exit(0);
      }
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
} else {
  throw new Error("Usage: node scripts/local-db.mjs start|stop|status");
}
