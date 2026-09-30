import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM todos ORDER BY id DESC");
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const title = String(req.body.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Title is required." });
    const { rows } = await pool.query(
      "INSERT INTO todos (title) VALUES ($1) RETURNING *",
      [title]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE todos SET done = COALESCE($1, done), title = COALESCE($2, title) WHERE id = $3 RETURNING *",
      [req.body.done ?? null, req.body.title ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Todo not found." });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM todos WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Todo not found." });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
