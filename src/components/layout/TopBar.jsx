import "./TopBar.css";
import { Link } from "react-router-dom";

export default function TopBar({ chess = {} }) {
  const { rating = 0, ratingChange = 0, showRatingChange = false, currentBot = "talc", isThinking = false, botRating = 0, doldolcoin = 0 } = chess;
  return (
    <header className="topBar">
      <Link className="logo" to="/">♟ Rockey Chess</Link>
      <nav className="topNav">
        <Link to="/">대국</Link>
        <Link to="/pvp">실시간 PvP</Link>
        <Link to="/shop">돌이코인 상점</Link>
        <Link to="/customize">꾸미기</Link>
      </nav>
      <div className="topRight">
        <div className="coinPill">🪙 {Number(doldolcoin || 0).toLocaleString()}</div>
        <div className="ratingArea"><div className="rating">⭐ {rating}</div>{showRatingChange && <div className={ratingChange >= 0 ? "ratingUp" : "ratingDown"}>{ratingChange >= 0 ? `+${ratingChange}` : ratingChange}</div>}</div>
        <div className="aiStatus">{isThinking ? "🤖 생각 중..." : "🟢 대기"} · {currentBot} {botRating}</div>
      </div>
    </header>
  );
}
