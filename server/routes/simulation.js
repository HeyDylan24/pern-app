import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";

const execFileAsync = promisify(execFile);
const router = Router();
const routeDirectory = path.dirname(fileURLToPath(import.meta.url));
const simulationScript = path.resolve(routeDirectory, "../irrigation/run_simulation.py");
const projectRoot = path.resolve(routeDirectory, "../..");
const bundledPython = path.join(
  projectRoot,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);

router.post("/run", async (req, res) => {
  const { days, seed = 2024 } = req.body ?? {};
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return res.status(400).json({ error: "Choose a simulation length from 1 to 30 days." });
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    return res.status(400).json({ error: "The simulation seed must be a non-negative integer." });
  }

  const python = process.env.PYTHON_EXECUTABLE || (
    existsSync(bundledPython) ? bundledPython : (process.platform === "win32" ? "python" : "python3")
  );
  try {
    const { stdout } = await execFileAsync(
      python,
      [simulationScript, String(days), String(seed)],
      { timeout: 120_000, maxBuffer: 1_000_000, windowsHide: true }
    );
    res.json(JSON.parse(stdout));
  } catch (error) {
    console.error("Irrigation simulation failed:", error.stderr || error.message);
    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({ error: "The simulation took too long. Try a shorter run." });
    }
    res.status(503).json({
      error: "The simulation could not run. Check that Python and the irrigation model dependencies are installed.",
    });
  }
});

export default router;
