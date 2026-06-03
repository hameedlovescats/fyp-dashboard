export default function Tasks() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-600">Workflow and recommendations management</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Future Work</h2>
        <p className="mt-2 text-sm text-slate-600">
          This feature is planned for future development. Task management will enable users to create and track recommended actions based on predicted pest risk.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">Planned Features</h3>
          <ul className="text-sm text-slate-700 space-y-1">
            <li>• Automated task generation from alerts</li>
            <li>• Action recommendations and tracking</li>
            <li>• Team collaboration and assignment</li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">Expected Timeline</h3>
          <p className="text-sm text-slate-700">Under evaluation for Phase 2 development</p>
        </div>
      </div>
    </div>
  );
}
