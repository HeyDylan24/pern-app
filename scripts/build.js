import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const environmentPython = process.env.PYTHON_INSTALL_EXECUTABLE;
const candidates = environmentPython
  ? [[environmentPython, []]]
  : windows
    ? [["python", []], ["py", ["-3"]]]
    : [["python3", []], ["python", []]];

function run(command, args, label) {
  let executable = command;
  let commandArgs = args;
  if (windows && command === "npm") {
    if (!process.env.npm_execpath) {
      throw new Error("Run the build with `npm run build` so npm can be found.");
    }
    executable = process.execPath;
    commandArgs = [process.env.npm_execpath, ...args];
  }
  const result = spawnSync(executable, commandArgs, { cwd: root, stdio: "inherit" });
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} exited with status ${result.status ?? "unknown"}.`);
  }
}

function findPython() {
  for (const [command, prefix] of candidates) {
    const result = spawnSync(command, [...prefix, "--version"], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status === 0) {
      return { command, prefix };
    }
  }
  throw new Error(
    "Python 3 was not found. Install Python 3 and ensure it is available on PATH during the app build."
  );
}

const python = findPython();
const virtualEnvironment = path.join(root, ".venv");
const venvPython = windows
  ? path.join(virtualEnvironment, "Scripts", "python.exe")
  : path.join(virtualEnvironment, "bin", "python");

console.log("Creating the simulation Python environment...");
run(python.command, [...python.prefix, "-m", "venv", virtualEnvironment], "Creating Python virtual environment");
console.log("Installing the irrigation model dependencies...");
run(
  venvPython,
  ["-m", "pip", "install", "--disable-pip-version-check", "-r", path.join(root, "server", "requirements.txt")],
  "Installing Python dependencies"
);
run(
  "npm",
  ["install", "--prefix", "client", "--include=dev"],
  "Installing frontend dependencies"
);
run("npm", ["run", "build", "--prefix", "client"], "Building frontend");
run("npm", ["install", "--prefix", "server"], "Installing API dependencies");
