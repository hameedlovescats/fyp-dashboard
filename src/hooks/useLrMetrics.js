import { useEffect, useState } from "react";

export function useLrMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const res = await fetch("/lr_metrics.json", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setMetrics(json);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  return { metrics, loading };
}
