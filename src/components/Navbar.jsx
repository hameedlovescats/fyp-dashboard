import { NavLink } from "react-router-dom";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "rounded-lg px-3 py-2 text-sm font-medium",
          isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b bg-slate-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white text-sm font-semibold">
            PR
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-slate-900">Pest Risk Dashboard</div>
            <div className="text-xs text-slate-500">FYP MVP (results viewer)</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <NavItem to="/">Overview</NavItem>
          <NavItem to="/check-risk">Check Risk</NavItem>
          <NavItem to="/fields">Fields</NavItem>
          <NavItem to="/sensors">Sensors</NavItem>
          <NavItem to="/tasks">Tasks</NavItem>
          <NavItem to="/model">Model</NavItem>
        </nav>
      </div>
    </header>
  );
}
