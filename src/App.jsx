import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import AgriAssistant from "./components/AgriAssistant.jsx";

import Overview from "./pages/Overview.jsx";
import Fields from "./pages/Fields.jsx";
import FieldDetail from "./pages/FieldDetail.jsx";
import Sensors from "./pages/Sensors.jsx";
import Tasks from "./pages/Tasks.jsx";
import Model from "./pages/Model.jsx";
import CheckRisk from "./pages/CheckRisk.jsx";

export default function App() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <Navbar />

      <main className="app-main">
        <div className={isHome ? "" : "route-shell"}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/check-risk" element={<CheckRisk />} />
            <Route path="/fields" element={<Fields />} />
            <Route path="/fields/:clientId" element={<FieldDetail />} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/model" element={<Model />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <AgriAssistant />
    </div>
  );
}
