/** Backward-compatible entry: initialize real configuration; never insert demo business records. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
if (process.argv.includes("--force")) {
  console.error("--force is disabled: this project preserves real database records.");
  process.exit(1);
}
const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx",
  fileURLToPath(new URL("./initialize.ts", import.meta.url))], { windowsHide: true, stdio: "inherit" });
child.on("error", () => { console.error("Could not initialize the database."); process.exitCode = 1; });
child.on("close", (code) => { process.exitCode = code ?? 1; });
