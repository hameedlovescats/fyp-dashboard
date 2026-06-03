import { useMemo, useState } from "react";
import Papa from "papaparse";
import { API_BASE } from "../config.js";

/* ---------- Date helpers (timezone-safe) ---------- */
function parseISODateLocal(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODateLocal(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextMondayAfter(dateObj) {
  const weekday = dateObj.getDay(); // Sun=0
  const mondayBased = (weekday + 6) % 7;
  let daysAhead = (7 - mondayBased) % 7;
  if (daysAhead === 0) daysAhead = 7;
  const out = new Date(dateObj);
  out.setDate(out.getDate() + daysAhead);
  return out;
}

/* ================================================== */

export default function CheckRisk() {
  const [clientId, setClientId] = useState("");
  const [targetWeekStart, setTargetWeekStart] = useState("");
  const [file, setFile] = useState(null);

  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState("");

  const [useManual, setUseManual] = useState(false);
  const [manual, setManual] = useState({
    lag_1: "",
    lag_2: "",
    lag_3: "",
    lag_4: "",
    lag_5: "",
    lag_6: "",
    lag_7: "",
    lag_8: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  /* ---------- CSV → last 8 weeks ---------- */
  const last8 = useMemo(() => {
    if (!csvRows.length) return [];
    const sorted = [...csvRows].sort((a, b) => a.weekDate - b.weekDate);
    return sorted.slice(-8);
  }, [csvRows]);

  const lagMap = useMemo(() => {
    if (last8.length !== 8) return null;
    const counts = last8.map((r) => r.count);
    return {
      lag_8: counts[0],
      lag_7: counts[1],
      lag_6: counts[2],
      lag_5: counts[3],
      lag_4: counts[4],
      lag_3: counts[5],
      lag_2: counts[6],
      lag_1: counts[7],
    };
  }, [last8]);

  /* ---------- Result % formatter (FINAL FIX) ---------- */
  const probHighRiskPct = useMemo(() => {
    if (!result || result.prob_high_risk == null) return "";
    const p = Number(result.prob_high_risk);
    if (Number.isNaN(p)) return "";
    return (p * 100).toFixed(1);
  }, [result]);

  /* ---------- CSV upload ---------- */
  function onPickFile(f) {
    setResult(null);
    setApiError("");
    setCsvError("");
    setCsvRows([]);
    setFile(f);
    if (!f) return;

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (res) => {
        const cleaned = [];

        for (const r of res.data || []) {
          const ws = String(r.week_start || "").trim();
          const ct = Number(r.count);

          if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) {
            setCsvError(`Invalid week_start: ${ws}`);
            return;
          }
          if (Number.isNaN(ct)) {
            setCsvError(`Invalid count: ${r.count}`);
            return;
          }

          cleaned.push({
            week_start: ws,
            weekDate: parseISODateLocal(ws),
            count: ct,
          });
        }

        if (cleaned.length < 8) {
          setCsvError(`Need at least 8 rows, found ${cleaned.length}`);
          setCsvRows(cleaned);
          return;
        }

        const sorted = [...cleaned].sort((a, b) => a.weekDate - b.weekDate);
        const mostRecent = sorted[sorted.length - 1].weekDate;
        const autoTarget = nextMondayAfter(mostRecent);

        setTargetWeekStart((prev) => prev || toISODateLocal(autoTarget));
        setCsvRows(cleaned);
      },
      error: () => setCsvError("Failed to parse CSV."),
    });
  }

  /* ---------- API call ---------- */
  async function runPredict() {
    setLoading(true);
    setApiError("");
    setResult(null);

    try {
      if (!clientId.trim()) throw new Error("client_id is required");

      /* ---- Manual mode ---- */
      if (useManual) {
        if (!targetWeekStart) throw new Error("Select target week start");

        const payload = {
          client_id: clientId.trim(),
          target_week_start: targetWeekStart,
        };

        for (let i = 1; i <= 8; i++) {
          const v = Number(manual[`lag_${i}`]);
          if (Number.isNaN(v)) throw new Error(`lag_${i} must be a number`);
          payload[`lag_${i}`] = v;
        }

        const res = await fetch(`${API_BASE}/api/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(await res.text());
        setResult(await res.json());
        return;
      }

      /* ---- File mode ---- */
      if (!file) throw new Error("Upload a CSV file");

      const fd = new FormData();
      fd.append("client_id", clientId.trim());
      fd.append("file", file);
      if (targetWeekStart) fd.append("target_week_start", targetWeekStart);

      const res = await fetch(`${API_BASE}/api/predict-file`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setApiError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Save prediction ---------- */
  async function savePrediction() {
    if (!result) return;
    
    setSaving(true);
    setSaveSuccess("");
    
    try {
      const savePayload = {
        client_id: result.client_id,
        target_week_start: result.target_week_start,
        prob_high_risk: result.prob_high_risk,
        status: result.status,
      };

      const res = await fetch(`${API_BASE}/api/save-prediction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSaveSuccess(data.message ||  "Saved successfully!");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch (e) {
      setApiError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  /* ================== UI ================== */
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold">Check Risk (new client)</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* ---------- LEFT ---------- */}
        <div className="rounded-2xl border bg-white p-4">
          <label className="text-sm font-medium">client_id</label>
          <input
            className="mt-2 w-full rounded-xl border px-3 py-2"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />

          <label className="text-sm font-medium mt-4 block">
            Target week start (Monday)
          </label>
          <input
            type="date"
            className="mt-2 w-full rounded-xl border px-3 py-2"
            value={targetWeekStart}
            onChange={(e) => setTargetWeekStart(e.target.value)}
          />

          <div className="mt-5">
            <label className="text-sm font-medium">
              Upload CSV (week_start,count)
            </label>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full text-sm"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
            {csvError && <p className="text-red-600 mt-2">{csvError}</p>}
          </div>

          <div className="mt-5 flex gap-2">
            <input
              type="checkbox"
              checked={useManual}
              onChange={(e) => setUseManual(e.target.checked)}
            />
            <span className="text-sm font-medium">Enter manually</span>
          </div>

          {useManual && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Object.keys(manual).map((k) => (
                <input
                  key={k}
                  placeholder={k}
                  className="rounded-xl border px-3 py-2"
                  value={manual[k]}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, [k]: e.target.value }))
                  }
                />
              ))}
            </div>
          )}

          <button
            className="mt-6 w-full rounded-xl bg-black px-4 py-2 text-white"
            onClick={runPredict}
            disabled={loading}
          >
            {loading ? "Scoring..." : "Check risk"}
          </button>

          {apiError && <p className="text-red-600 mt-3">{apiError}</p>}
        </div>

        {/* ---------- RIGHT ---------- */}
        <div className="rounded-2xl border bg-white p-4">
          {last8.length === 8 && (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>week_start</th>
                  <th>count</th>
                  <th>maps to</th>
                </tr>
              </thead>
              <tbody>
                {last8.map((r, i) => (
                  <tr key={i}>
                    <td>{r.week_start}</td>
                    <td>{r.count}</td>
                    <td>{`lag_${8 - i}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result && (
            <div className="mt-6 rounded-xl border p-4">
              <div className="flex justify-between">
                <div>
                  <div className="text-gray-600">Result</div>
                  <div className="text-xl font-semibold">{result.status}</div>
                </div>
                <div>
                  <div className="text-gray-600">prob_high_risk</div>
                  <div className="text-xl font-semibold">
                    {probHighRiskPct}%
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>decision_threshold: {result.decision_threshold}</div>
                <div>week_of_year: {result.week_of_year}</div>
                <div className="col-span-2">
                  target_week_start: {result.target_week_start}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <button
                  onClick={savePrediction}
                  disabled={saving}
                  className="rounded-xl border bg-white px-4 py-2 text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save to system"}
                </button>
                {saveSuccess && (
                  <p className="text-green-600 text-sm font-medium">{saveSuccess}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
