import { useEffect, useState } from "react";
import Papa from "papaparse";

export function useCsv(url) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
        const text = await res.text();

        const parsed = Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });

        if (parsed.errors?.length) {
          throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
        }

        if (alive) setRows(parsed.data || []);
      } catch (e) {
        if (alive) setError(String(e.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [url]);

  return { rows, loading, error };
}
