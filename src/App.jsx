import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Chess from "./pages/Chess.jsx";
import Login from "./pages/Login.jsx";
import Shop from "./pages/Shop.jsx";
import Customize from "./pages/Customize.jsx";
import PvP from "./pages/PvP.jsx";
import SiteSidebar from "./components/layout/SiteSidebar.jsx";
import "./AppShell.css";

function DoriMainSiteButton() {
  return (
    <a className="dori-main-site-button" href="https://rockey-jason.github.io/doldol-site/" aria-label="돌이사이트 메인으로 이동" title="돌이사이트 메인으로 이동">
      <span className="dori-main-home-mark" aria-hidden="true">D</span>
      <span className="dori-main-home-label">돌이사이트 메인</span>
      <span className="dori-main-home-arrow" aria-hidden="true">↗</span>
    </a>
  );
}

function Shell({ children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  if (isLogin) return <><DoriMainSiteButton />{children}</>;
  return (
    <>
      <DoriMainSiteButton />
      <div className="appShell">
        <SiteSidebar />
        <main className="pageContent">{children}</main>
      </div>
    </>
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
