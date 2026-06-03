export function formatPercent(prob) {
  const n = Number(prob);
  if (!Number.isFinite(n)) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

export function safeNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse week start value that could be epoch ms (number) or ISO date string (YYYY-MM-DD)
 * Returns a Date object or null
 */
export function parseWeekStart(value) {
  if (!value && value !== 0) return null;

  // Try as epoch milliseconds
  const ms = Number(value);
  if (Number.isFinite(ms) && ms > 1000000000) {
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Try as ISO date string (YYYY-MM-DD)
  const str = String(value).trim();
  if (str.length === 10 && str.includes("-")) {
    try {
      const d = new Date(str + "T00:00:00Z");
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  return null;
}

export function epochMsToDate(ms) {
  return parseWeekStart(ms);
}

export function formatDateShort(d) {
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function formatWeekLabel(target_week_start) {
  const d = parseWeekStart(target_week_start);
  if (!d) return "N/A";
  const y = getISOWeekYear(d);
  const w = String(getISOWeek(d)).padStart(2, "0");
  return `${y}-W${w} (${formatDateShort(d)})`;
}
