import express from "express";
import cors from "cors";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import todos from "./routes/todos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/todos", todos);

// In production, serve the built React app from the same server.
const dist = path.join(__dirname, "../client/dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// Create tables on startup (safe to run repeatedly).
try {
  await pool.query(readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
} catch (err) {
  console.error("Could not initialise the database:", err.message);
}

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
