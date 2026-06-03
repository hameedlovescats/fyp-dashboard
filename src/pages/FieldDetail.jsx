import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../components/Loading.jsx";
import { useClientHistory } from "../hooks/useClientHistory.js";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { fetchJsonWithTimeout } from "../utils/fetchWithTimeout.js";
import { API_BASE } from "../config.js";

export default function FieldDetail() {
  const { clientId } = useParams();
  const decodedId = decodeURIComponent(clientId || "");
  const { data, loading, error, source } = useClientHistory(decodedId);
  const [displayName, setDisplayName] = useState(decodedId);
  const [threshold, setThreshold] = useState(0.67);
  const [thresholdError, setThresholdError] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(true);

  // Load client display name and threshold with timeouts
  useEffect(() => {
    async function loadData() {
      try {
        const mapping = await fetchJsonWithTimeout(`${API_BASE}/api/client-mapping`, 4000);
        setDisplayName(mapping[decodedId] || decodedId);
      } catch (e) {
        console.log("Could not load client mapping:", e);
      }

      try {
        const metrics = await fetchJsonWithTimeout(`${API_BASE}/api/model-metrics`, 4000);
        setThreshold(metrics.decision_threshold || 0.67);
        setThresholdError(false);
      } catch (e) {
        console.log("Could not load model metrics:", e);
        setThresholdError(true);
      } finally {
        setMappingLoading(false);
      }
    }
    loadData();
  }, [decodedId]);

  if (loading || mappingLoading) return <Loading label="Loading history..." />;

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="font-semibold text-slate-900">Could not load history</div>
        <div className="mt-2 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  const chartData = (data || [])
    .map((r) => ({
      x: String(r.target_week_start ?? ""),
      prob_high_risk: Number(r.prob_high_risk ?? 0),
      y_count: Number(r.y_count ?? 0),
      source: String(r.source ?? "historical"),
    }))
    .sort((a, b) => a.x.localeCompare(b.x));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{displayName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Field ID: {decodedId} | Source: {source}
          </p>
        </div>
        <Link to="/fields" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
          ← Back to Fields
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {chartData.length === 0 ? (
          <div className="text-sm text-slate-600">No history for this field.</div>
        ) : (
          <>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" minTickGap={20} angle={-45} height={80} />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const point = chartData.find((d) => d.x === label);
                      const source = point?.source || "historical";
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-md">
                          <p className="text-xs text-slate-600">{label}</p>
                          {payload.map((entry, i) => (
                            <p key={i} style={{ color: entry.color }} className="text-xs font-medium">
                              {entry.name === "prob_high_risk"
                                ? `Risk: ${(entry.value * 100).toFixed(1)}%`
                                : `Count: ${Math.round(entry.value)} pests`}
                            </p>
                          ))}
                          <p className="mt-1 text-xs italic text-slate-500">
                            {source === "user" ? "User saved prediction" : "Historical data"}
                          </p>
                        </div>
                      );
                    }}
                  />
                  {!thresholdError && (
                    <ReferenceLine
                      y={threshold}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{
                        value: `Threshold: ${(threshold * 100).toFixed(0)}%${thresholdError ? " (default)" : ""}`,
                        position: "insideTopRight",
                        offset: -10,
                        fill: "#ef4444",
                        fontSize: 12,
                      }}
                    />
                  )}
                  <Line type="monotone" dataKey="prob_high_risk" dot={{ fill: "#3b82f6", r: 4 }} strokeWidth={2} stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 text-sm text-slate-600">
              <p>
                <strong className="text-slate-900">Risk Chart:</strong> Blue line shows predicted risk (probability of high pest count). Red dashed line marks the alert threshold ({(threshold * 100).toFixed(0)}%{thresholdError ? " – default, metrics unavailable" : ""}). When risk exceeds the threshold, the field status becomes "ALERT".
              </p>
            </div>

            {chartData.some((d) => d.y_count !== undefined && d.y_count !== 0) && (
              <div style={{ width: "100%", height: 280, marginTop: "1.5rem" }}>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Pest Count History</h3>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" minTickGap={20} angle={-45} height={80} />
                    <YAxis />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const point = chartData.find((d) => d.x === label);
                        const source = point?.source || "historical";
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-md">
                            <p className="text-xs text-slate-600">{label}</p>
                            <p className="text-xs font-medium text-emerald-700">
                              Count: {Math.round(payload[0]?.value || 0)} pests
                            </p>
                            <p className="mt-1 text-xs italic text-slate-500">
                              {source === "user" ? "User saved prediction (no observed count yet)" : "Historical data"}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="y_count" dot={{ fill: "#10b981", r: 3 }} stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
