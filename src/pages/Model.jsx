import { useEffect, useState } from "react";
import Loading from "../components/Loading.jsx";
import { useModelMetrics } from "../hooks/useModelMetrics.js";
import { fetchJsonWithTimeout } from "../utils/fetchWithTimeout.js";
import { API_BASE } from "../config.js";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function CalibrationPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetch_calibration() {
      try {
        const json = await fetchJsonWithTimeout(`${API_BASE}/api/calibration`, 5000);
        setData(json);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    }
    fetch_calibration();
  }, []);

  if (loading) return <div className="text-sm text-slate-600">Loading calibration...</div>;
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data?.available)
    return <div className="text-sm text-slate-600">{data?.message}</div>;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Calibration (Decision Support)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-slate-600 mb-2">Brier Score</p>
          <div className="text-2xl font-bold text-slate-900">
            {data.brier_score != null ? Number(data.brier_score).toFixed(4) : "N/A"}
          </div>
          <p className="text-xs text-slate-500 mt-1">Lower is better (0=perfect)</p>
        </div>
        <div>
          <p className="text-sm text-slate-600 mb-2">Test Samples</p>
          <div className="text-2xl font-bold text-slate-900">{data.n_samples_test || 0}</div>
          <p className="text-xs text-slate-500 mt-1">Used for validation</p>
        </div>
      </div>

      <div className="mt-6 bg-slate-50 rounded-xl p-4">
        <p className="text-xs text-slate-700 leading-relaxed">
          <strong>What this means:</strong> {data.interpretation}
        </p>
      </div>

      {data.curve && data.curve.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700 mb-3">Reliability Diagram</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border px-3 py-2 text-left">Predicted Prob</th>
                  <th className="border px-3 py-2 text-left">Actual Prob</th>
                  <th className="border px-3 py-2 text-left">Samples</th>
                </tr>
              </thead>
              <tbody>
                {data.curve.map((pt, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="border px-3 py-2">{(pt.prob_pred * 100).toFixed(0)}%</td>
                    <td className="border px-3 py-2">{(pt.prob_true * 100).toFixed(0)}%</td>
                    <td className="border px-3 py-2">{pt.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ThresholdSweepPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetch_sweep() {
      try {
        const json = await fetchJsonWithTimeout(`${API_BASE}/api/threshold-sweep`, 5000);
        setData(json);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    }
    fetch_sweep();
  }, []);

  if (loading) return <div className="text-sm text-slate-600">Loading threshold analysis...</div>;
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data?.available)
    return <div className="text-sm text-slate-600">{data?.message}</div>;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Threshold Transparency (Decision Support)</h3>
      <div className="bg-blue-50 rounded-xl p-3 mb-4 border border-blue-200">
        <p className="text-sm font-medium text-blue-900">Current threshold: {data.current_threshold}</p>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 mb-4">
        <p className="text-xs text-slate-700 leading-relaxed">
          <strong>Why threshold matters:</strong> {data.interpretation}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border px-3 py-2 text-left font-medium">Threshold</th>
              <th className="border px-3 py-2 text-left font-medium">Precision</th>
              <th className="border px-3 py-2 text-left font-medium">Recall</th>
              <th className="border px-3 py-2 text-left font-medium">Specificity</th>
              <th className="border px-3 py-2 text-left font-medium">F1</th>
              <th className="border px-3 py-2 text-left font-medium">Predicted +</th>
            </tr>
          </thead>
          <tbody>
            {data.thresholds?.map((row, i) => (
              <tr
                key={i}
                className={`${
                  Math.abs(row.threshold - data.current_threshold) < 0.01
                    ? "bg-yellow-50"
                    : "hover:bg-slate-50"
                }`}
              >
                <td className="border px-3 py-2 font-medium">{row.threshold.toFixed(2)}</td>
                <td className="border px-3 py-2">{(row.precision * 100).toFixed(0)}%</td>
                <td className="border px-3 py-2">{(row.recall * 100).toFixed(0)}%</td>
                <td className="border px-3 py-2">{(row.specificity * 100).toFixed(0)}%</td>
                <td className="border px-3 py-2">{(row.f1 * 100).toFixed(0)}%</td>
                <td className="border px-3 py-2">{row.n_predicted_positive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InterpretabilityPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetch_interp() {
      try {
        const json = await fetchJsonWithTimeout(`${API_BASE}/api/model-interpretability`, 5000);
        setData(json);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    }
    fetch_interp();
  }, []);

  if (loading) return <div className="text-sm text-slate-600">Loading feature importance...</div>;
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data?.available)
    return <div className="text-sm text-slate-600">{data?.message || data?.error}</div>;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Interpretability: What Drives Risk? (Decision Support)</h3>

      <div className="bg-slate-50 rounded-xl p-4 mb-4">
        <p className="text-xs text-slate-700 leading-relaxed">
          <strong>How to read:</strong> {data.interpretation}
        </p>
      </div>

      {data.features && data.features.length > 0 ? (
        <div className="space-y-3">
          {data.features.map((feat, i) => (
            <div key={i} className="border rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-slate-900">{feat.feature}</p>
                  <p className="text-sm text-slate-600 mt-1">{feat.interpretation}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Odds ratio: {feat.odds_ratio.toFixed(3)}
                  </p>
                  <p className="text-xs text-slate-500">Log-odds: {feat.log_odds.toFixed(4)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-600">No feature data available.</div>
      )}
    </div>
  );
}

export default function Model() {
  const { metrics, comparison, loading, error, source } = useModelMetrics();

  if (loading) return <Loading label="Loading model info..." />;

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="font-semibold text-slate-900">Could not load model metrics</div>
        <div className="mt-2 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  const modelName = metrics?.model || "Logistic Regression (final)";
  const thr = metrics?.prob_threshold ?? metrics?.threshold ?? "N/A";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Model</h1>
        <p className="mt-1 text-sm text-slate-600">
          Final model: {modelName} | Source: {source}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Threshold" value={String(thr)} />
        <Metric
          label="ROC AUC"
          value={
            metrics?.roc_auc != null
              ? Number(metrics.roc_auc).toFixed(3)
              : "N/A"
          }
        />
        <Metric
          label="PR AUC"
          value={
            metrics?.pr_auc != null
              ? Number(metrics.pr_auc).toFixed(3)
              : "N/A"
          }
        />
        <Metric
          label="F1"
          value={
            metrics?.f1 != null ? Number(metrics.f1).toFixed(3) : "N/A"
          }
        />
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">model</th>
              <th className="px-4 py-3 font-medium">f1</th>
              <th className="px-4 py-3 font-medium">roc_auc</th>
              <th className="px-4 py-3 font-medium">pr_auc</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(comparison || []).map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-slate-900">{r.model}</td>
                <td className="px-4 py-3">
                  {r.f1 != null ? Number(r.f1).toFixed(3) : "N/A"}
                </td>
                <td className="px-4 py-3">
                  {r.roc_auc != null ? Number(r.roc_auc).toFixed(3) : "N/A"}
                </td>
                <td className="px-4 py-3">
                  {r.pr_auc != null ? Number(r.pr_auc).toFixed(3) : "N/A"}
                </td>
              </tr>
            ))}
            {(comparison || []).length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No model comparison available (optional file).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <CalibrationPanel />
        <ThresholdSweepPanel />
        <InterpretabilityPanel />
      </div>
    </div>
  );
}
