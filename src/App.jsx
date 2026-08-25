import { Routes, Route, Navigate } from "react-router-dom";
import Chess from "./pages/Chess.jsx";
import Login from "./pages/Login.jsx";
import Shop from "./pages/Shop.jsx";
import Customize from "./pages/Customize.jsx";
import PvP from "./pages/PvP.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Chess />} />
      <Route path="/login" element={<Login />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/customize" element={<Customize />} />
      <Route path="/pvp" element={<PvP />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
