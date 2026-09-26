import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import "./SiteSidebar.css";

const items = [
  { to: "/", icon: "♟", label: "대국", hint: "컴퓨터와 체스" },
  { to: "/pvp", icon: "⚔", label: "실시간 PvP", hint: "레이팅 매치" },
  { to: "/shop", icon: "◈", label: "Rock-King Shop", hint: "체스 전용 상점" },
  { to: "/customize", icon: "✦", label: "꾸미기", hint: "보드 · 기물 · 프로필" },
];

export default function SiteSidebar() {
  const [profile, setProfile] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      const loginId = user.user_metadata?.login_id || user.user_metadata?.username || user.email?.split("@")[0] || user.id;
      const { data } = await supabase.from("users").select("nickname,login_id,chess_rating,profile_image,rock_king_coin").eq("login_id", loginId).maybeSingle();
      if (alive) setProfile({ ...data, loginId });
    })();
    return () => { alive = false; };
  }, []);

  return (
    <aside className={`siteSidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="siteBrand">
        <div className="brandMark">R</div>
        {!collapsed && <div><strong>ROCKEY</strong><span>CHESS</span></div>}
        <button className="collapseButton" onClick={() => setCollapsed(v => !v)} aria-label="메뉴 접기">{collapsed ? "›" : "‹"}</button>
      </div>

      {!collapsed && <div className="navCaption">PLAY</div>}
      <nav className="siteNav">
        {items.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `siteNavItem ${isActive ? "active" : ""}`}>
            <span className="navIcon">{item.icon}</span>
            {!collapsed && <span className="navText"><b>{item.label}</b><small>{item.hint}</small></span>}
            {!collapsed && <span className="navArrow">›</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="sideWallet">
          <div className="walletLabel">ROCK-KING-COIN</div>
          <strong>◈ {Number(profile?.rock_king_coin || 0).toLocaleString()}</strong>
          <span>돌이사이트의 돌돌코인과 분리된 체스 전용 화폐</span>
        </div>
      )}

      <div className="sideProfile">
        <div className="sideAvatar">{profile?.profile_image ? <img src={profile.profile_image} alt="" /> : "♙"}</div>
        {!collapsed && <div><b>{profile?.nickname || profile?.loginId || "게스트"}</b><small>{Number(profile?.chess_rating || 0).toLocaleString()} RATING</small></div>}
      </div>
    </aside>
  );
}
