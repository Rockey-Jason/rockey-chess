import { Routes, Route } from "react-router-dom";
import Chess from "./pages/Chess.jsx";
import Login from "./pages/Login.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Chess />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}