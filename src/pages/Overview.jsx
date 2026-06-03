import { useMemo, useState, useEffect } from "react";
import StatCard from "../components/StatCard.jsx";
import AlertsTable from "../components/AlertsTable.jsx";
import Loading from "../components/Loading.jsx";
import { useLatestAlerts } from "../hooks/useLatestAlerts.js";
import { parseWeekStart, formatDateShort, safeNumber, formatPercent, formatWeekLabel } from "../utils/format.js";
import { fetchJsonWithTimeout } from "../utils/fetchWithTimeout.js";
import { API_BASE } from "../config.js";

export default function Overview() {
  const { data, loading, error } = useLatestAlerts();
  const [clientMapping, setClientMapping] = useState({});
  const [mappingLoading, setMappingLoading] = useState(true);

  // Load client display name mapping with timeout
  useEffect(() => {
    async function loadMapping() {
      try {
        const mapping = await fetchJsonWithTimeout(`${API_BASE}/api/client-mapping`, 4000);
        setClientMapping(mapping);
      } catch (e) {
        console.log("Could not load client mapping:", e);
        setClientMapping({});
      } finally {
        setMappingLoading(false);
      }
    }
    loadMapping();
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("risk");
  const [sortDir, setSortDir] = useState("desc");

  const summary = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const alertSites = rows.filter((r) => Number(r.alert) === 1).length;

    let maxRisk = -1;
    let maxRow = null;
    let latestDate = null;

    for (const r of rows) {
      const pr = safeNumber(r.prob_high_risk, 0);
      if (pr > maxRisk) {
        maxRisk = pr;
        maxRow = r;
      }

      // Find latest week by comparing dates properly
      const d = parseWeekStart(r.target_week_start);
      if (d && (!latestDate || d > latestDate)) {
        latestDate = d;
      }
    }

    const clientName = maxRow ? clientMapping[maxRow.client_id] || maxRow.client_id : "N/A";

    return {
      alertSites,
      highestRiskLabel: maxRow
        ? `${clientName} (${formatPercent(maxRow.prob_high_risk)} at ${formatWeekLabel(maxRow.target_week_start)})`
        : "N/A",
      lastUpdated: latestDate ? formatDateShort(latestDate) : "N/A",
    };
  }, [data, clientMapping]);

  const filteredSorted = useMemo(() => {
    const s = search.trim().toLowerCase();
    let rows = Array.isArray(data) ? [...data] : [];

    if (s) rows = rows.filter((r) => String(r.client_id || "").toLowerCase().includes(s));
    if (statusFilter === "alert") rows = rows.filter((r) => Number(r.alert) === 1);
    if (statusFilter === "ok") rows = rows.filter((r) => Number(r.alert) !== 1);

    const dir = sortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (sortKey === "risk") return (safeNumber(a.prob_high_risk) - safeNumber(b.prob_high_risk)) * dir;
      if (sortKey === "client") return String(a.client_id).localeCompare(String(b.client_id)) * dir;
      if (sortKey === "week") {
        const dateA = parseWeekStart(a.target_week_start);
        const dateB = parseWeekStart(b.target_week_start);
        const timeA = dateA ? dateA.getTime() : -Infinity;
        const timeB = dateB ? dateB.getTime() : -Infinity;
        return (timeA - timeB) * dir;
      }
      if (sortKey === "status") return (safeNumber(a.alert) - safeNumber(b.alert)) * dir;
      return 0;
    });

    return rows;
  }, [data, search, statusFilter, sortKey, sortDir]);

  if (loading || mappingLoading) return <Loading label="Loading latest_alerts.json..." />;

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-slate-900">Could not load data</div>
        <div className="mt-2 text-sm text-rose-700">{error}</div>
        <div className="mt-4 text-sm text-slate-600">
          Check: http://localhost:5173/latest_alerts.json
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">Exported results viewer.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="# ALERT sites" value={String(summary.alertSites)} subtitle="From latest export" />
        <StatCard title="Highest risk site" value={summary.highestRiskLabel} subtitle="Max probability" />
        <StatCard title="Last updated" value={summary.lastUpdated} subtitle="Latest week timestamp" />
      </div>

      <AlertsTable
        rows={filteredSorted}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortKey={sortKey}
        setSortKey={setSortKey}
        sortDir={sortDir}
        setSortDir={setSortDir}
        clientMapping={clientMapping}
      />
    </div>
  );
}
