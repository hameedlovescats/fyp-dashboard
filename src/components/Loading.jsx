export default function Loading({ label = "Loading..." }) {
  return (
    <div className="rounded-2xl border bg-white p-6 text-slate-600 shadow-sm">
      {label}
    </div>
  );
}
