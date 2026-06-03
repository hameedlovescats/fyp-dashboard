import { useEffect, useState } from "react";
import Papa from "papaparse";
import { API_BASE } from "../config.js";

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

export function useModelMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState("api");

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/model-metrics`, 4000);
        if (!res.ok) throw new Error(`API failed (${res.status})`);
        const json = await res.json();
        if (alive) {
          setMetrics(json.metrics ?? null);
          setComparison(Array.isArray(json.comparison) ? json.comparison : []);
          setSource("api");
        }
      } catch (e) {
        try {
          const mRes = await fetch("/lr_metrics.json", { cache: "no-store" });
          const mJson = mRes.ok ? await mRes.json() : null;

          let compRows = [];
          const cRes = await fetch("/model_comparison.csv", { cache: "no-store" });
          if (cRes.ok) {
            const text = await cRes.text();
            const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
            compRows = parsed.data || [];
          }

          if (alive) {
            setMetrics(mJson);
            setComparison(compRows);
            setSource("static");
          }
        } catch (e2) {
          if (alive) setError(String(e2.message || e2));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => { alive = false; };
  }, []);

  return { metrics, comparison, loading, error, source };
}
