import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/feature.css";
import "./ChessStats.css";

const loginFromUser = user => user?.user_metadata?.login_id || user?.user_metadata?.username || user?.email?.split("@")[0] || user?.id || null;
const resultLabel = result => result === "1-0" ? "승리" : result === "0-1" ? "패배" : result === "1/2-1/2" ? "무승부" : "진행 중";
const resultClass = result => result === "1-0" ? "win" : result === "0-1" ? "loss" : "draw";

function monthBuckets(games) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: `${date.getMonth() + 1}월`, count: games.filter(g => String(g.created_at || "").slice(0, 7) === key).length };
  });
}

export default function ChessStats() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [games, setGames] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (!alive) return;
      if (authError || !currentUser) {
        setUser(null);
        setGames([]);
        setLoading(false);
        return;
      }
      setUser(currentUser);
      const loginId = loginFromUser(currentUser);
      const [profileResult, gamesResult] = await Promise.all([
        supabase.from("users").select("login_id,nickname,name,chess_rating,profile_image").eq("login_id", loginId).maybeSingle(),
        supabase.from("chess_games").select("id,mode,bot_id,result,pgn,accuracy,summary,created_at,pvp_room_id").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(500)
      ]);
      if (!alive) return;
      if (profileResult.error) console.warn("Chess profile:", profileResult.error.message);
      if (gamesResult.error) setError("전적을 불러오지 못했습니다. 데이터베이스 권한과 연결을 확인해 주세요.");
      setProfile(profileResult.data || {});
      setGames(gamesResult.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const wins = games.filter(g => g.result === "1-0").length;
    const losses = games.filter(g => g.result === "0-1").length;
    const draws = games.filter(g => g.result === "1/2-1/2").length;
    const valid = wins + losses + draws;
    const accuracyGames = games.filter(g => Number(g.accuracy) > 0);
    const accuracy = accuracyGames.length ? accuracyGames.reduce((sum, g) => sum + Number(g.accuracy), 0) / accuracyGames.length : 0;
    let streak = 0;
    for (const game of games) {
      if (game.result !== "1-0") break;
      streak += 1;
    }
    return { wins, losses, draws, valid, accuracy, streak, winRate: valid ? wins / valid * 100 : 0, pvp: games.filter(g => g.mode === "pvp").length, bot: games.filter(g => g.mode !== "pvp").length };
  }, [games]);

  const monthly = useMemo(() => monthBuckets(games).map(item => ({ ...item, height: Math.max(5, item.count / Math.max(1, ...monthBuckets(games).map(x => x.count)) * 100) })), [games]);
  const visible = useMemo(() => games.filter(g => filter === "all" || (filter === "pvp" ? g.mode === "pvp" : g.mode !== "pvp")), [games, filter]);

  const download = game => {
    if (!game.pgn) return;
    const blob = new Blob([game.pgn], { type: "application/x-chess-pgn;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dori-chess-${String(game.created_at || "").slice(0, 10) || "game"}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="featurePage"><div className="featureShell"><div className="notice">체스 기록을 불러오는 중…</div></div></div>;

  return <div className="featurePage chessStatsPage"><div className="featureShell chessStatsShell">
    <div className="chessStatsHero">
      <div><div className="featureKicker">DORI CHESS · PLAYER PROFILE</div><h1 className="featureTitle">전적 및 통계</h1><p className="featureSub">대국 기록과 실력 변화를 한눈에 확인하세요.</p></div>
      <div className="statsRating"><span>현재 레이팅</span><strong>{Number(profile.chess_rating || 0).toLocaleString()}</strong><small>{profile.nickname || profile.name || profile.login_id || "플레이어"}</small></div>
    </div>
    {!user ? <div className="statsLogin"><div className="statsEmptyIcon">♙</div><h2>로그인이 필요합니다</h2><p>로그인하면 저장된 대국 기록과 개인 통계를 확인할 수 있어요.</p><Link className="featureButton" to="/login">로그인하기</Link></div> : <>
      {error && <div className="notice">{error}</div>}
      <div className="statsKpis">
        <div className="statsKpi"><span>전체 대국</span><strong>{stats.valid.toLocaleString()}</strong><small>AI {stats.bot} · PvP {stats.pvp}</small></div>
        <div className="statsKpi"><span>승률</span><strong>{stats.winRate.toFixed(1)}%</strong><small>승리 {stats.wins} · 무승부 {stats.draws} · 패배 {stats.losses}</small></div>
        <div className="statsKpi"><span>평균 정확도</span><strong>{stats.accuracy ? `${stats.accuracy.toFixed(1)}%` : "—"}</strong><small>분석 정보가 저장된 대국 기준</small></div>
        <div className="statsKpi"><span>현재 연승</span><strong>{stats.streak}</strong><small>최근 기록 기준</small></div>
      </div>
      <div className="statsPanels">
        <section className="statsPanel statsActivity">
          <div className="statsPanelHead"><div><span>ACTIVITY</span><h2>최근 6개월 대국</h2></div><b>{stats.valid} games</b></div>
          <div className="statsChart" role="img" aria-label="최근 6개월 대국 수 막대그래프">{monthly.map(m=><div className="statsBarGroup" key={m.key}><div className="statsBarTrack"><i style={{ height: `${m.height}%` }} title={`${m.count} games`}/></div><small>{m.label}</small><b>{m.count}</b></div>)}</div>
        </section>
        <section className="statsPanel">
          <div className="statsPanelHead"><div><span>RESULTS</span><h2>경기 결과</h2></div></div>
          <div className="statsResultList">
            <div><span className="resultDot win"/>승리 <b>{stats.wins}</b></div>
            <div><span className="resultDot draw"/>무승부 <b>{stats.draws}</b></div>
            <div><span className="resultDot loss"/>패배 <b>{stats.losses}</b></div>
          </div>
          <div className="statsResultTrack"><i className="win" style={{ width: `${stats.valid ? stats.wins / stats.valid * 100 : 0}%` }}/><i className="draw" style={{ width: `${stats.valid ? stats.draws / stats.valid * 100 : 0}%` }}/><i className="loss" style={{ width: `${stats.valid ? stats.losses / stats.valid * 100 : 0}%` }}/></div>
          <p className="statsFootnote">승률은 승리 ÷ 완료된 전체 대국으로 계산합니다.</p>
        </section>
      </div>
      <section className="statsPanel statsHistoryPanel">
        <div className="statsPanelHead"><div><span>GAME ARCHIVE</span><h2>대국 기록</h2></div><div className="statsFilters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체</button><button className={filter === "bot" ? "active" : ""} onClick={() => setFilter("bot")}>AI</button><button className={filter === "pvp" ? "active" : ""} onClick={() => setFilter("pvp")}>PvP</button></div></div>
        {visible.length ? <div className="statsGameList">{visible.slice(0, 100).map(game => {
          const summary = game.summary || {};
          const opponent = game.mode === "pvp" ? (summary.opponent || "온라인 상대") : (summary.black || game.bot_id || "AI");
          return <article className="statsGameRow" key={game.id}>
            <div className={`statsResultTag ${resultClass(game.result)}`}>{resultLabel(game.result)}</div>
            <div className="statsGameMain"><b>{game.mode === "pvp" ? "실시간 대전" : `AI 대국 · ${opponent}`}</b><small>{new Date(game.created_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })} · {game.mode === "pvp" ? opponent : "컴퓨터 대전"}</small></div>
            <div className="statsGameAccuracy"><span>정확도</span><b>{Number(game.accuracy) > 0 ? `${Number(game.accuracy).toFixed(1)}%` : "—"}</b></div>
            <button className="statsPgnButton" onClick={() => download(game)} disabled={!game.pgn}>PGN 저장</button>
          </article>;
        })}</div> : <div className="statsEmpty"><div className="statsEmptyIcon">♜</div><h3>아직 저장된 대국이 없습니다</h3><p>첫 대국을 마치면 이곳에 기록이 쌓입니다.</p><Link to="/" className="featureButton">대국 시작하기</Link></div>}
      </section>
    </>}
    <div className="statsBottomLinks"><Link to="/openings">오프닝 학습 →</Link><Link to="/">대국으로 돌아가기 →</Link></div>
  </div></div>;
}
