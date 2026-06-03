import { useEffect, useState } from "react";
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

export function useLatestAlerts() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState("api");

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/latest-alerts`, 4000);
        if (!res.ok) throw new Error(`API failed (${res.status})`);
        const json = await res.json();
        if (!Array.isArray(json)) throw new Error("API latest-alerts did not return an array");
        if (alive) {
          setData(json);
          setSource("api");
        }
      } catch (e) {
        try {
          const res2 = await fetch("/latest_alerts.json", { cache: "no-store" });
          if (!res2.ok) throw new Error(`Static latest_alerts.json failed (${res2.status})`);
          const json2 = await res2.json();
          if (!Array.isArray(json2)) throw new Error("latest_alerts.json is not an array");
          if (alive) {
            setData(json2);
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

  return { data, loading, error, source };
}
