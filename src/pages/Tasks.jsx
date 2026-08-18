import { useEffect, useMemo, useState } from "react";
import { useLatestAlerts } from "../hooks/useLatestAlerts.js";

const STORAGE_KEY = "agriai-action-board-v1";

function seedTasks(rows) {
  const sorted = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => Number(b.prob_high_risk || 0) - Number(a.prob_high_risk || 0));
  const alertRows = sorted.filter((row) => Number(row.alert) === 1);
  const seeds = [];

  alertRows.slice(0, 3).forEach((row, index) => {
    seeds.push({
      id: `alert-${row.client_id}-${index}`,
      title: `Scout ${row.client_id} and confirm pest pressure`,
      field: row.client_id,
      priority: "high",
      done: false,
      generated: true,
    });
  });

  sorted.filter((row) => Number(row.alert) !== 1).slice(0, 2).forEach((row, index) => {
    seeds.push({
      id: `watch-${row.client_id}-${index}`,
      title: `Review weekly trend for ${row.client_id}`,
      field: row.client_id,
      priority: "medium",
      done: false,
      generated: true,
    });
  });

  if (!seeds.length) {
    seeds.push({ id: "routine-scout", title: "Complete routine weekly scouting", field: "All fields", priority: "medium", done: false, generated: true });
  }
  return seeds;
}

export default function Tasks() {
  const { data } = useLatestAlerts();
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(stored) && stored.length) setTasks(stored);
      else setTasks(seedTasks(data));
    } catch {
      setTasks(seedTasks(data));
    } finally {
      setReady(true);
    }
  }, [data]);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, ready]);

  const counts = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter((task) => !task.done).length,
    done: tasks.filter((task) => task.done).length,
    urgent: tasks.filter((task) => !task.done && task.priority === "high").length,
  }), [tasks]);

  const visible = tasks.filter((task) => filter === "all" || (filter === "open" && !task.done) || (filter === "done" && task.done) || (filter === "high" && task.priority === "high" && !task.done));

  function addTask(event) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setTasks((current) => [{ id: `manual-${Date.now()}`, title: clean, field: "Custom", priority, done: false, generated: false }, ...current]);
    setTitle("");
  }

  function toggle(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  function remove(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  return (
    <div className="feature-page">
      <div className="feature-page-head">
        <div><span className="eyebrow">FIELD ACTIONS</span><h1>Turn signals into work.</h1></div>
        <p>AgriAI seeds this board from the highest-risk fields, then lets you add, prioritize and complete your own field actions. Tasks persist in this browser.</p>
      </div>

      <div className="feature-kpis">
        <div className="feature-kpi"><small>TOTAL ACTIONS</small><strong>{counts.total}</strong></div>
        <div className="feature-kpi"><small>OPEN</small><strong>{counts.open}</strong></div>
        <div className="feature-kpi"><small>HIGH PRIORITY</small><strong>{counts.urgent}</strong></div>
        <div className="feature-kpi"><small>COMPLETED</small><strong>{counts.done}</strong></div>
      </div>

      <form className="task-composer" onSubmit={addTask}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a field action, e.g. Inspect traps in Kandy…" />
        <select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="medium">Medium priority</option><option value="high">High priority</option><option value="low">Low priority</option></select>
        <button type="submit">Add action</button>
      </form>

      <div className="filter-row">
        {[['all','All'],['open','Open'],['high','High priority'],['done','Completed']].map(([key,label]) => <button type="button" className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}
      </div>

      <div className="task-list">
        {visible.map((task) => (
          <article className={`task-row ${task.done ? "done" : ""}`} key={task.id}>
            <button type="button" className={`task-check ${task.done ? "done" : ""}`} onClick={() => toggle(task.id)} aria-label={task.done ? "Mark open" : "Mark complete"}>✓</button>
            <div className="task-copy"><strong>{task.title}</strong><small>{task.field} · {task.generated ? "Suggested from dashboard context" : "Added by you"}</small></div>
            <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
            <button type="button" className="task-remove" onClick={() => remove(task.id)} aria-label="Remove task">×</button>
          </article>
        ))}
        {!visible.length ? <div className="empty-state">Nothing here. Change the filter or add a new field action.</div> : null}
      </div>
    </div>
  );
}
