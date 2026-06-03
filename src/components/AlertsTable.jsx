import { formatPercent, formatWeekLabel } from "../utils/format.js";

function StatusPill({ alert }) {
  const isAlert = Number(alert) === 1;
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        isAlert ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
      ].join(" ")}
    >
      {isAlert ? "ALERT" : "OK"}
    </span>
  );
}

export default function AlertsTable({
  rows,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  clientMapping = {},
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client_id..."
            className="w-full sm:w-72 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-40 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="all">All</option>
            <option value="alert">ALERT</option>
            <option value="ok">OK</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="w-full sm:w-44 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="risk">Sort: risk</option>
            <option value="client">Sort: client</option>
            <option value="week">Sort: week</option>
            <option value="status">Sort: status</option>
          </select>

          <button
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            className="rounded-xl border bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
            type="button"
          >
            {sortDir === "desc" ? "Desc" : "Asc"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Field Name</th>
              <th className="px-4 py-3 font-medium">week</th>
              <th className="px-4 py-3 font-medium">risk %</th>
              <th className="px-4 py-3 font-medium">status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const displayName = clientMapping[r.client_id] || r.client_id;
              return (
                <tr key={`${r.client_id}-${r.target_week_start}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{displayName}</td>
                  <td className="px-4 py-3 text-slate-700">{formatWeekLabel(r.target_week_start)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatPercent(r.prob_high_risk)}</td>
                  <td className="px-4 py-3">
                    <StatusPill alert={r.alert} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No rows match your search/filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
