import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AlertsTable from "../components/AlertsTable.jsx";
import FieldScene from "../components/FieldScene.jsx";
import Loading from "../components/Loading.jsx";
import { useLatestAlerts } from "../hooks/useLatestAlerts.js";
import { API_BASE } from "../config.js";
import { fetchJsonWithTimeout } from "../utils/fetchWithTimeout.js";
import { formatPercent, safeNumber } from "../utils/format.js";

function Icon({ type }) {
  const icons = {
    field: "M4 19c4-5 8-8 16-11M4 14c4-3 8-5 16-7M4 9c3-1 7-2 12-2",
    alert: "M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01",
    pulse: "M3 12h4l2-5 4 10 2-5h6",
    model: "M5 5h14v14H5zM9 9h6v6H9z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[type]} /></svg>;
}

export default function Overview() {
  const { data, loading, error } = useLatestAlerts();
  const [clientMapping, setClientMapping] = useState({});
  const [modelInfo, setModelInfo] = useState({ threshold: 0.67, auc: null });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("risk");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    Promise.allSettled([
      fetchJsonWithTimeout(`${API_BASE}/api/client-mapping`, 30000),
      fetchJsonWithTimeout(`${API_BASE}/api/model-metrics`, 30000),
    ]).then(([mapping, metrics]) => {
      if (mapping.status === "fulfilled") setClientMapping(mapping.value || {});
      if (metrics.status === "fulfilled") {
        const payload = metrics.value || {};
        setModelInfo({
          threshold: Number(payload.decision_threshold ?? payload.metrics?.prob_threshold ?? 0.67),
          auc: payload.metrics?.roc_auc ?? null,
        });
      }
    });
  }, []);

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const summary = useMemo(() => {
    const sorted = [...rows].sort((a, b) => safeNumber(b.prob_high_risk) - safeNumber(a.prob_high_risk));
    const alerts = rows.filter((row) => Number(row.alert) === 1);
    const avg = rows.length ? rows.reduce((sum, row) => sum + safeNumber(row.prob_high_risk), 0) / rows.length : 0;
    const top = sorted[0] || null;
    return { sorted, alerts, avg, top };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let output = [...rows];
    if (needle) output = output.filter((row) => String(row.client_id || "").toLowerCase().includes(needle));
    if (statusFilter === "alert") output = output.filter((row) => Number(row.alert) === 1);
    if (statusFilter === "ok") output = output.filter((row) => Number(row.alert) !== 1);
    const direction = sortDir === "asc" ? 1 : -1;
    output.sort((a, b) => {
      if (sortKey === "risk") return (safeNumber(a.prob_high_risk) - safeNumber(b.prob_high_risk)) * direction;
      if (sortKey === "client") return String(a.client_id).localeCompare(String(b.client_id)) * direction;
      if (sortKey === "status") return (safeNumber(a.alert) - safeNumber(b.alert)) * direction;
      if (sortKey === "week") return String(a.target_week_start).localeCompare(String(b.target_week_start)) * direction;
      return 0;
    });
    return output;
  }, [rows, search, statusFilter, sortKey, sortDir]);

  if (loading) return <div className="home-loading"><Loading label="Waking field intelligence…" /></div>;

  if (error) {
    return <div className="hero-error"><span>DATA LINK INTERRUPTED</span><h1>We could not reach the field dataset.</h1><p>{error}</p></div>;
  }

  const topName = summary.top ? clientMapping[summary.top.client_id] || summary.top.client_id : "Field network";
  const topRisk = safeNumber(summary.top?.prob_high_risk, 0);

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow"><i /> PEST RISK · EARLY WARNING · DECISION SUPPORT</span>
          <h1>See the outbreak<br /><em>before it spreads.</em></h1>
          <p>
            AgriAI turns weekly field history into a living risk picture — so scouting, prediction and action happen in one place.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" to="/check-risk">Run a risk check <span>↗</span></Link>
            <Link className="button-ghost" to="/fields">Explore fields</Link>
          </div>
          <div className="hero-proof">
            <span><strong>{rows.length}</strong> field profiles</span>
            <span><strong>{Math.round(modelInfo.threshold * 100)}%</strong> alert threshold</span>
            <span><strong>{modelInfo.auc != null ? Number(modelInfo.auc).toFixed(3) : "Live"}</strong> ROC AUC</span>
          </div>
        </div>
        <FieldScene risk={topRisk} field={topName} />
      </section>

      <section className="signal-strip" aria-label="System status">
        <div><span className="live-dot" /> LIVE MODEL</div>
        <div>LOGISTIC REGRESSION</div>
        <div>WEEKLY FIELD SIGNALS</div>
        <div>THRESHOLD {modelInfo.threshold.toFixed(2)}</div>
        <div>HUMAN-IN-THE-LOOP</div>
      </section>

      <section className="metric-grid">
        <article className="metric-card"><span className="metric-icon"><Icon type="field" /></span><div><small>MONITORED FIELDS</small><strong>{rows.length}</strong><p>Profiles visible in the latest dataset</p></div></article>
        <article className="metric-card"><span className="metric-icon alert"><Icon type="alert" /></span><div><small>ACTIVE ALERTS</small><strong>{summary.alerts.length}</strong><p>Above the current decision threshold</p></div></article>
        <article className="metric-card"><span className="metric-icon"><Icon type="pulse" /></span><div><small>NETWORK AVERAGE</small><strong>{formatPercent(summary.avg)}</strong><p>Average predicted high-risk probability</p></div></article>
        <article className="metric-card"><span className="metric-icon"><Icon type="model" /></span><div><small>MODEL STATUS</small><strong className="status-word">ONLINE</strong><p>Backend + inference pipeline available</p></div></article>
      </section>

      <section className="command-grid">
        <div className="command-card risk-board">
          <div className="section-head">
            <div><span className="eyebrow">RISK COMMAND</span><h2>Where should you look first?</h2></div>
            <Link to="/fields">All fields ↗</Link>
          </div>
          <div className="risk-list">
            {summary.sorted.slice(0, 6).map((row, index) => {
              const risk = safeNumber(row.prob_high_risk);
              const name = clientMapping[row.client_id] || row.client_id;
              return (
                <Link to={`/fields/${encodeURIComponent(row.client_id)}`} className="risk-row" key={`${row.client_id}-${row.target_week_start}`}>
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <div className="risk-main"><strong>{name}</strong><small>{row.target_week_start || "No date"}</small></div>
                  <div className="risk-track"><i style={{ width: `${Math.max(3, risk * 100)}%` }} /></div>
                  <span className={`risk-value ${Number(row.alert) === 1 ? "hot" : ""}`}>{formatPercent(risk)}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="command-card action-board">
          <div className="section-head"><div><span className="eyebrow">ACTION INTELLIGENCE</span><h2>Next best moves.</h2></div></div>
          <div className="action-stack">
            {summary.alerts.length > 0 ? (
              <>
                <div className="action-item urgent"><span>01</span><div><strong>Scout {clientMapping[summary.alerts[0].client_id] || summary.alerts[0].client_id}</strong><p>Confirm pest pressure before treatment. This field is above the alert threshold.</p></div></div>
                <div className="action-item"><span>02</span><div><strong>Record pest counts</strong><p>Capture current observations so the next prediction has better operational context.</p></div></div>
                <div className="action-item"><span>03</span><div><strong>Review adjacent fields</strong><p>Compare nearby or operationally related fields for the same upward signal.</p></div></div>
              </>
            ) : (
              <>
                <div className="action-item"><span>01</span><div><strong>Maintain weekly scouting</strong><p>No field is currently above the model threshold.</p></div></div>
                <div className="action-item"><span>02</span><div><strong>Watch the top-risk field</strong><p>{topName} is currently highest at {formatPercent(topRisk)}.</p></div></div>
                <div className="action-item"><span>03</span><div><strong>Log fresh observations</strong><p>Recent field observations improve the usefulness of decision support.</p></div></div>
              </>
            )}
          </div>
          <Link className="inline-cta" to="/tasks">Open action board <span>→</span></Link>
        </aside>
      </section>

      <section className="process-section">
        <div className="section-head wide"><div><span className="eyebrow">FROM SIGNAL TO DECISION</span><h2>A field workflow, not just a probability.</h2></div><p>The model raises attention. The farmer, agronomist or field team confirms what is happening and chooses the action.</p></div>
        <div className="process-grid">
          <article><span>01</span><h3>Observe</h3><p>Weekly pest counts and field history become model features.</p></article>
          <article><span>02</span><h3>Predict</h3><p>The trained model estimates the probability of a high-risk week.</p></article>
          <article><span>03</span><h3>Decide</h3><p>Thresholds, explanations and field scouting turn the signal into action.</p></article>
        </div>
      </section>

      <section className="data-section">
        <div className="section-head wide"><div><span className="eyebrow">FIELD REGISTER</span><h2>All visible risk signals.</h2></div><p>Search, sort and drill into the same underlying dataset used by the rest of the dashboard.</p></div>
        <div className="table-shell">
          <AlertsTable rows={filteredSorted} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} clientMapping={clientMapping} />
        </div>
      </section>

      <footer className="home-footer"><strong>AgriAI</strong><span>EARLY SIGNALS · BETTER SCOUTING · HUMAN DECISIONS</span><small>Decision-support prototype · FYP</small></footer>
    </div>
  );
}
