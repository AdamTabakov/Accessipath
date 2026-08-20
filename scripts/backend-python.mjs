// Runs a Python command inside backend/ using the project venv when present,
// falling back to `python` on PATH. Keeps `npm run dev:backend` etc. working
// without manually activating the virtual environment first.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(root, "backend");
const venvPython =
  process.platform === "win32"
    ? join(backendDir, ".venv", "Scripts", "python.exe")
    : join(backendDir, ".venv", "bin", "python");

const python = existsSync(venvPython) ? venvPython : "python";
const result = spawnSync(python, process.argv.slice(2), {
  stdio: "inherit",
  cwd: backendDir,
});
if (result.error) {
  console.error(`Failed to run ${python}:`, result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);