import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../components/Loading.jsx";
import { useLatestAlerts } from "../hooks/useLatestAlerts.js";
import { formatPercent, formatWeekLabel } from "../utils/format.js";
import { fetchJsonWithTimeout } from "../utils/fetchWithTimeout.js";
import { API_BASE } from "../config.js";

function StatusPill({ alert }) {
  const isAlert = Number(alert) === 1;
  return (
    <span
      className={[
        "rounded-full px-2 py-1 text-xs font-medium",
        isAlert ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
      ].join(" ")}
    >
      {isAlert ? "ALERT" : "OK"}
    </span>
  );
}

export default function Fields() {
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

  if (loading || mappingLoading) return <Loading label="Loading fields..." />;

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="font-semibold text-slate-900">Could not load latest_alerts.json</div>
        <div className="mt-2 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  const rows = [...data].sort((a, b) => String(a.client_id).localeCompare(String(b.client_id)));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Fields</h1>
        <p className="mt-1 text-sm text-slate-600">Pick a field to view its risk history chart.</p>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Field Name</th>
              <th className="px-4 py-3 font-medium">client_id</th>
              <th className="px-4 py-3 font-medium">latest week</th>
              <th className="px-4 py-3 font-medium">risk %</th>
              <th className="px-4 py-3 font-medium">status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const displayName = clientMapping[r.client_id] || `Field ${rows.indexOf(r) + 1}`;
              return (
                <tr key={`${r.client_id}-${r.target_week_start}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{displayName}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{r.client_id}</td>
                  <td className="px-4 py-3 text-slate-700">{formatWeekLabel(r.target_week_start)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatPercent(r.prob_high_risk)}</td>
                  <td className="px-4 py-3">
                    <StatusPill alert={r.alert} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/fields/${encodeURIComponent(r.client_id)}`}
                      className="rounded-xl border bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  No fields found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
