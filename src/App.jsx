import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Chess from "./pages/Chess.jsx";
import Login from "./pages/Login.jsx";
import Shop from "./pages/Shop.jsx";
import Customize from "./pages/Customize.jsx";
import PvP from "./pages/PvP.jsx";
import SiteSidebar from "./components/layout/SiteSidebar.jsx";
import "./AppShell.css";

function Shell({ children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  if (isLogin) return children;
  return (
    <div className="appShell">
      <SiteSidebar />
      <main className="pageContent">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Chess />} />
        <Route path="/login" element={<Login />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/customize" element={<Customize />} />
        <Route path="/pvp" element={<PvP />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
