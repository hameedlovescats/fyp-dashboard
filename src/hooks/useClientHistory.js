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

export function useClientHistory(clientId) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState("api");

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!clientId) {
        setData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetchWithTimeout(
          `${API_BASE}/api/history?client_id=${encodeURIComponent(clientId)}`,
          4000
        );
        if (!res.ok) throw new Error(`API failed (${res.status})`);
        const json = await res.json();
        if (!Array.isArray(json)) throw new Error("API history did not return an array");
        if (alive) {
          setData(json);
          setSource("api");
        }
      } catch (e) {
        try {
          const res2 = await fetch("/alert_history.csv", { cache: "no-store" });
          if (!res2.ok) throw new Error(`Static alert_history.csv failed (${res2.status})`);
          const text = await res2.text();
          const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
          if (parsed.errors?.length) throw new Error(`CSV parse error: ${parsed.errors[0].message}`);

          const rows = (parsed.data || []).filter((r) => String(r.client_id) === String(clientId));
          const normalized = rows.map((r) => ({
            client_id: clientId,
            target_week_start: r.target_week_start ?? r.week ?? r.date ?? "",
            prob_high_risk: Number(r.prob_high_risk ?? r.risk ?? r.prob ?? 0),
            alert: r.alert ?? r.status ?? "",
          }));

          if (alive) {
            setData(normalized);
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
  }, [clientId]);

  return { data, loading, error, source };
}
