import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import "./SiteSidebar.css";

const items = [
  { to: "/", icon: "♟", label: "대국", hint: "컴퓨터와 체스" },
  { to: "/pvp", icon: "⚔", label: "실시간 PvP", hint: "레이팅 매치" },
  { to: "/openings", icon: "♞", label: "오프닝 학습", hint: "수순 · 전략 익히기" },
  { to: "/stats", icon: "▤", label: "전적 · 통계", hint: "기보 · 승률 · 레이팅" },
  { to: "/shop", icon: "◈", label: "Rock-King Shop", hint: "체스 전용 상점" },
  { to: "/customize", icon: "✦", label: "꾸미기", hint: "보드 · 기물 · 프로필" },
];

export default function SiteSidebar({ collapsed = false, onToggle = () => {} }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    let requestId = 0;

    const loadProfile = async user => {
      const request = ++requestId;
      if (!user) {
        if (alive) setProfile(null);
        return;
      }

      // The users table is protected by auth.uid() = users.user_id.
      const { data, error } = await supabase
        .from("users")
        .select("name,login_id,chess_rating,profile_image,rock_king_coin")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alive || request !== requestId) return;
      if (error) console.warn("Chess navigation profile:", error.message);
      const loginId = data?.login_id ||
        user.user_metadata?.login_id ||
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        user.id;
      setProfile({ ...(data || {}), loginId });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer the profile request so the auth callback itself stays synchronous.
      Promise.resolve().then(() => loadProfile(session?.user || null));
    });

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) console.warn("Chess navigation authentication:", error.message);
        return loadProfile(data?.user || null);
      })
      .catch(error => {
        if (alive) console.warn("Chess navigation profile load failed:", error);
      });

    return () => {
      alive = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <aside className={`siteSidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="siteBrand">
        <div className="brandMark">R</div>
        {!collapsed && <div><strong>ROCKEY</strong><span>CHESS</span></div>}
        <button
          className="collapseButton"
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
        >{collapsed ? "›" : "‹"}</button>
      </div>

      {!collapsed && <div className="navCaption">PLAY</div>}
      <nav className="siteNav">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `siteNavItem ${isActive ? "active" : ""}`}
          >
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
        {!collapsed && <div><b>{profile?.name || profile?.loginId || "게스트"}</b><small>{Number(profile?.chess_rating || 0).toLocaleString()} RATING</small></div>}
      </div>
    </aside>
  );
}
