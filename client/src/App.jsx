import { useEffect, useState } from "react";

const api = async (path, options) => {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
  return res.status === 204 ? null : res.json();
};

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const run = async (fn) => {
    try { setError(""); await fn(); } catch (e) { setError(e.message); }
  };

  useEffect(() => { run(async () => setTodos(await api("/todos"))); }, []);

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      const todo = await api("/todos", { method: "POST", body: JSON.stringify({ title }) });
      setTodos([todo, ...todos]);
      setTitle("");
    });
  };

  const toggle = (todo) =>
    run(async () => {
      const updated = await api(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !todo.done }),
      });
      setTodos(todos.map((t) => (t.id === todo.id ? updated : t)));
    });

  const remove = (id) =>
    run(async () => {
      await api(`/todos/${id}`, { method: "DELETE" });
      setTodos(todos.filter((t) => t.id !== id));
    });

  return (
    <main>
      <h1>Basic deployed site</h1>
      <form onSubmit={add}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" aria-label="New todo" />
        <button type="submit">Add todo</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {todos.length === 0 && !error && <p className="empty">Nothing here yet. Add your first todo above.</p>}
      <ul>
        {todos.map((t) => (
          <li key={t.id} className={t.done ? "done" : ""}>
            <label>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
              <span>{t.title}</span>
            </label>
            <button className="ghost" onClick={() => remove(t.id)} aria-label={`Delete ${t.title}`}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
