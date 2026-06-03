import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";

import Overview from "./pages/Overview.jsx";
import Fields from "./pages/Fields.jsx";
import FieldDetail from "./pages/FieldDetail.jsx";
import Sensors from "./pages/Sensors.jsx";
import Tasks from "./pages/Tasks.jsx";
import Model from "./pages/Model.jsx";
import CheckRisk from "./pages/CheckRisk.jsx";


export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/fields" element={<Fields />} />
          <Route path="/fields/:clientId" element={<FieldDetail />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/model" element={<Model />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/check-risk" element={<CheckRisk />} />

        </Routes>
      </main>
    </div>
  );
}
