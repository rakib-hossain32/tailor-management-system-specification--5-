import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function loadProjectEnv() {
  config({
    path: [resolve(projectRoot, ".env.local"), resolve(projectRoot, ".env")],
    quiet: true,
  });
}
