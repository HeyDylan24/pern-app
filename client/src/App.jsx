import { useEffect, useMemo, useState } from "react";

async function api(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Something went wrong. Please try again.");
  }

  return response.status === 204 ? null : response.json();
}

function Icon({ name, size = 18 }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /></>,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    done: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTodos = async () => {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      setTodos(await api("/todos"));
    } catch (requestError) {
      setError(requestError.message);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  const completedCount = todos.filter((todo) => todo.done).length;
  const openCount = todos.length - completedCount;
  const completion = todos.length ? Math.round((completedCount / todos.length) * 100) : 0;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  const visibleTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return todos.filter((todo) => {
      const matchesFilter = filter === "all" || (filter === "open" ? !todo.done : todo.done);
      return matchesFilter && todo.title.toLowerCase().includes(query);
    });
  }, [todos, filter, search]);

  const addTodo = async (event) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;

    setSaving(true);
    setError("");
    try {
      const todo = await api("/todos", {
        method: "POST",
        body: JSON.stringify({ title: cleanTitle }),
      });
      setTodos((current) => [todo, ...current]);
      setTitle("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTodo = async (todo) => {
    setError("");
    try {
      const updated = await api(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !todo.done }),
      });
      setTodos((current) => current.map((item) => item.id === todo.id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteTodo = async (todo) => {
    setError("");
    try {
      await api(`/todos/${todo.id}`, { method: "DELETE" });
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      if (editingId === todo.id) setEditingId(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveEdit = async (event, todo) => {
    event.preventDefault();
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      setError("A task needs a title.");
      return;
    }

    setError("");
    try {
      const updated = await api(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: cleanTitle }),
      });
      setTodos((current) => current.map((item) => item.id === todo.id ? updated : item));
      setEditingId(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const filters = [
    { id: "all", label: "All tasks", count: todos.length },
    { id: "open", label: "In progress", count: openCount },
    { id: "done", label: "Completed", count: completedCount },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Daymark home">
          <span className="brand-mark"><Icon name="check" size={19} /></span>
          <span>daymark<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-card">
          <span className="workspace-avatar">D</span>
          <span className="workspace-copy"><strong>My workspace</strong><small>Personal space</small></span>
          <span className="workspace-chevron" aria-hidden="true">⌄</span>
        </div>

        <nav className="sidebar-nav" aria-label="Task views">
          <p className="nav-heading">YOUR SPACE</p>
          {filters.map((item) => (
            <button
              className={`nav-item ${filter === item.id ? "is-active" : ""}`}
              key={item.id}
              onClick={() => setFilter(item.id)}
              aria-current={filter === item.id ? "page" : undefined}
            >
              <Icon name={item.id === "all" ? "list" : item.id === "done" ? "done" : "spark"} size={17} />
              <span>{item.label}</span>
              <span className="nav-count">{item.count}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><Icon name="spark" size={16} /></span>
            <p><strong>Small steps add up.</strong><br />Keep your momentum going.</p>
          </div>
          <div className="profile">
            <span className="profile-avatar">D</span>
            <span className="profile-copy"><strong>Dylan</strong><small>Personal account</small></span>
            <span className="profile-menu" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>My tasks</strong></div>
          <div className="today-label"><span className="today-dot" /> Your personal task list</div>
        </header>

        <div className="page-content">
          <section className="welcome">
            <div className="welcome-copy">
              <p className="eyebrow">{formatDate(new Date()).toUpperCase()}</p>
              <h1>{greeting}, Dylan<span className="wave">.</span></h1>
              <p className="welcome-subtitle">A little progress each day adds up to big results.</p>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <span className="art-sun" />
              <span className="art-hill art-hill-back" />
              <span className="art-hill art-hill-front" />
              <span className="art-star art-star-one">✳</span>
              <span className="art-star art-star-two">✦</span>
            </div>
          </section>

          <section className="stats-grid" aria-label="Task summary">
            <article className="stat-card">
              <span className="stat-icon stat-icon-lavender"><Icon name="list" size={18} /></span>
              <span className="stat-label">Total tasks</span>
              <strong className="stat-value">{todos.length}</strong>
              <span className="stat-caption">on your list</span>
            </article>
            <article className="stat-card">
              <span className="stat-icon stat-icon-peach"><Icon name="spark" size={18} /></span>
              <span className="stat-label">In progress</span>
              <strong className="stat-value">{openCount}</strong>
              <span className="stat-caption">ready when you are</span>
            </article>
            <article className="stat-card stat-card-progress">
              <span className="stat-icon stat-icon-green"><Icon name="done" size={18} /></span>
              <span className="stat-label">Completion</span>
              <strong className="stat-value">{completion}<small>%</small></strong>
              <span className="progress-track"><span className="progress-fill" style={{ width: `${completion}%` }} /></span>
            </article>
          </section>

          <section className="task-panel" aria-labelledby="task-list-title">
            <div className="panel-header">
              <div>
                <p className="section-kicker">YOUR PLAN</p>
                <h2 id="task-list-title">{filter === "done" ? "Completed tasks" : filter === "open" ? "In progress" : "All tasks"}<span className="task-total">{visibleTodos.length}</span></h2>
              </div>
              <label className="search-field">
                <Icon name="search" size={17} />
                <input
                  type="search"
                  placeholder="Search tasks"
                  aria-label="Search tasks"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && <button className="clear-search" type="button" onClick={() => setSearch("")} aria-label="Clear search"><Icon name="close" size={14} /></button>}
              </label>
            </div>

            <form className="add-task-form" onSubmit={addTodo}>
              <span className="add-task-icon"><Icon name="plus" size={18} /></span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a task to your list..."
                aria-label="New task title"
                maxLength={500}
              />
              <button className="add-task-button" type="submit" disabled={!title.trim() || saving}>
                <Icon name="plus" size={16} />
                <span>{saving ? "Adding..." : "Add task"}</span>
              </button>
            </form>

            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><Icon name="close" size={16} /></button>
              </div>
            )}

            <div className="task-list" aria-live="polite">
              {loading ? (
                <div className="list-message"><span className="loading-spinner" /> Loading your tasks...</div>
              ) : loadFailed ? (
                <div className="empty-state">
                  <span className="empty-icon"><Icon name="list" size={24} /></span>
                  <h3>Tasks are unavailable</h3>
                  <p>Check your connection, then try loading your list again.</p>
                  <button type="button" className="text-button" onClick={loadTodos}>Try again</button>
                </div>
              ) : visibleTodos.length ? (
                visibleTodos.map((todo) => (
                  <article className={`task-row ${todo.done ? "task-row-done" : ""}`} key={todo.id}>
                    <button
                      type="button"
                      className={`task-check ${todo.done ? "is-checked" : ""}`}
                      onClick={() => toggleTodo(todo)}
                      aria-label={todo.done ? `Mark ${todo.title} as in progress` : `Complete ${todo.title}`}
                    >
                      {todo.done && <Icon name="check" size={14} />}
                    </button>
                    {editingId === todo.id ? (
                      <form className="edit-task-form" onSubmit={(event) => saveEdit(event, todo)}>
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          aria-label="Edit task title"
                        />
                        <button type="submit" className="edit-save">Save</button>
                        <button type="button" className="edit-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <span className="task-title">{todo.title}</span>
                        <span className={`task-status ${todo.done ? "status-done" : "status-open"}`}>{todo.done ? "Done" : "In progress"}</span>
                        <div className="task-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => { setEditingId(todo.id); setEditTitle(todo.title); }}
                            aria-label={`Edit ${todo.title}`}
                          ><Icon name="edit" size={16} /></button>
                          <button type="button" className="icon-button delete-button" onClick={() => deleteTodo(todo)} aria-label={`Delete ${todo.title}`}><Icon name="trash" size={16} /></button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <span className="empty-icon"><Icon name={search ? "search" : filter === "done" ? "done" : "spark"} size={24} /></span>
                  <h3>{search ? "No matching tasks" : filter === "done" ? "Nothing completed yet" : "Your list is clear"}</h3>
                  <p>{search ? "Try another search, or clear the search field." : filter === "done" ? "Completed tasks will show up here." : "Add a task above and take the first step."}</p>
                  {search && <button type="button" className="text-button" onClick={() => setSearch("")}>Clear search</button>}
                </div>
              )}
            </div>

            {!loading && todos.length > 0 && (
              <footer className="panel-footer">
                <span>{openCount === 0 ? "Everything is wrapped up. Nice work!" : `${openCount} ${openCount === 1 ? "task" : "tasks"} left to do`}</span>
                <span className="footer-motivation"><Icon name="spark" size={14} /> Keep going</span>
              </footer>
            )}
          </section>

          <footer className="page-footer">Made for focused days <span>·</span> One task at a time</footer>
        </div>
      </main>
    </div>
  );
}
