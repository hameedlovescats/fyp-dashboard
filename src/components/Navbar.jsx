import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const items = [
  ["/", "Command"],
  ["/check-risk", "Predict"],
  ["/fields", "Fields"],
  ["/sensors", "Sensors"],
  ["/tasks", "Actions"],
  ["/model", "Intelligence"],
];

function LeafMark() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <path d="M35.8 7.5C24 7.6 13.1 11.7 9.3 20.8c-3 7.2.5 13 6.4 15.7 6.1 2.8 12.6-.3 15.8-6.8 3.7-7.4 2.4-15.8 4.3-22.2Z" fill="currentColor" opacity=".95" />
      <path d="M10 35c6.4-8.2 12.3-13.5 20-18.2" fill="none" stroke="#07140f" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="agri-nav-wrap">
      <div className="agri-nav">
        <NavLink to="/" className="brand-lockup" aria-label="AgriAI home">
          <span className="brand-mark"><LeafMark /></span>
          <span>
            <strong>AgriAI</strong>
            <small>FIELD INTELLIGENCE</small>
          </span>
        </NavLink>

        <nav className={`nav-links ${open ? "is-open" : ""}`} aria-label="Primary navigation">
          {items.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `nav-pill ${isActive ? "active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-status">
          <span className="status-dot" />
          <span>MODEL ONLINE</span>
        </div>

        <button
          type="button"
          className="nav-menu-button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
