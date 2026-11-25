import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { databaseConnectionUrl } from "./src/db/url";

config({ path: [".env.local", ".env"], quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Run npm run setup or configure .env.local.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseConnectionUrl(process.env.DATABASE_URL) },
});
