import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { OPENINGS } from "../data/chessOpenings";
import { supabase } from "../supabase";
import "../styles/feature.css";
import "./OpeningStudy.css";

const pieceSrc = piece => piece ? `${import.meta.env.BASE_URL}pieces/${piece.color}${piece.type.toUpperCase()}.png` : "";
const uciFrom = move => `${move.from}${move.to}${move.promotion || ""}`;

function buildGame(log) {
  const game = new Chess();
  for (const uci of log) {
    const move = game.moves({ verbose: true }).find(m => uciFrom(m) === uci);
    if (!move) break;
    game.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
  }
  return game;
}

export default function OpeningStudy() {
  const [openingId, setOpeningId] = useState(OPENINGS[0].id);
  const opening = OPENINGS.find(item => item.id === openingId) || OPENINGS[0];
  const [moveLog, setMoveLog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("밝게 표시된 칸을 눌러 합법적인 수를 둘 수 있습니다.");
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("전체");
  const savedRef = useRef("");

  const game = useMemo(() => buildGame(moveLog), [moveLog]);
  const legalTargets = useMemo(() => selected ? game.moves({ square:selected, verbose:true }).map(m => m.to) : [], [game, selected]);
  const expected = opening.moves[moveLog.length];
  const onLine = moveLog.every((move, index) => move === opening.moves[index]);
  const complete = onLine && moveLog.length === opening.moves.length;
  const last = moveLog.length ? moveLog[moveLog.length - 1] : "";
  const filtered = OPENINGS.filter(item => filter === "전체" || item.family === filter);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data:{ user:currentUser } } = await supabase.auth.getUser();
      if (!alive || !currentUser) return;
      setUser(currentUser);
      const { data, error } = await supabase.from("chess_opening_progress").select("opening_id,completed_count,best_ply,last_completed_at").eq("user_id", currentUser.id);
      if (!error && alive) setProgress(Object.fromEntries((data || []).map(row => [row.opening_id, row])));
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setMoveLog([]);
    setSelected(null);
    setMessage("첫 수부터 순서대로 따라 두어 보세요.");
    setSaveMessage("");
    savedRef.current = "";
  }, [openingId]);

  useEffect(() => {
    if (!user || !complete || savedRef.current === opening.id) return;
    savedRef.current = opening.id;
    let alive = true;
    (async () => {
      setSaving(true);
      const previous = Number(progress[opening.id]?.completed_count || 0);
      const next = {
        user_id:user.id,
        opening_id:opening.id,
        completed_count:previous + 1,
        best_ply:Math.max(Number(progress[opening.id]?.best_ply || 0), moveLog.length),
        last_completed_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      };
      const { error } = await supabase.from("chess_opening_progress").upsert(next, { onConflict:"user_id,opening_id" });
      if (!alive) return;
      setSaving(false);
      if (error) {
        savedRef.current = "";
        setSaveMessage("진도 저장에 실패했습니다. 로그인과 연결 상태를 확인해 주세요.");
      } else {
        setProgress(prev => ({ ...prev, [opening.id]:next }));
        setSaveMessage("오프닝 학습 완료! 진도가 계정에 저장되었습니다.");
      }
    })();
    return () => { alive = false; };
  }, [complete, moveLog.length, opening.id, progress, user]);

  const playMove = (from, to) => {
    const move = game.moves({ verbose:true }).find(m => m.from === from && m.to === to);
    if (!move) return;
    const nextLog = [...moveLog, uciFrom(move)];
    setMoveLog(nextLog);
    setSelected(null);
    const expectedMove = opening.moves[moveLog.length];
    if (uciFrom(move) === expectedMove) {
      setMessage(opening.lesson[moveLog.length] || "좋은 수입니다. 이어서 다음 포지션을 살펴보세요.");
    } else {
      setMessage("합법적인 수입니다. 다만 준비된 오프닝 수순과는 다른 선택이에요. 자유롭게 비교해 보세요.");
    }
  };

  const clickSquare = square => {
    if (selected && legalTargets.includes(square)) {
      playMove(selected, square);
      return;
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) setSelected(selected === square ? null : square);
    else setSelected(null);
  };

  const playRecommended = () => {
    if (!expected || !onLine) return;
    const from = expected.slice(0,2);
    const to = expected.slice(2,4);
    const promotion = expected[4] || undefined;
    try {
      const next = new Chess(game.fen());
      const move = next.move({ from, to, ...(promotion ? { promotion } : {}) });
      if (!move) {
        setMessage("준비된 수순을 현재 포지션에 적용할 수 없습니다. 처음부터 다시 시작해 주세요.");
        return;
      }
      setMoveLog(prev => [...prev, uciFrom(move)]);
      setSelected(null);
      setMessage(opening.lesson[moveLog.length] || "다음 수를 확인했습니다.");
    } catch {
      setMessage("이 수를 적용하지 못했습니다. 처음부터 다시 시작해 주세요.");
    }
  };

  const undo = () => {
    setMoveLog(prev => prev.slice(0,-1));
    setSelected(null);
    setSaveMessage("");
    savedRef.current = "";
    setMessage("한 수 전 포지션으로 돌아왔습니다.");
  };

  const restart = () => {
    setMoveLog([]);
    setSelected(null);
    setSaveMessage("");
    savedRef.current = "";
    setMessage("처음 포지션으로 돌아왔습니다.");
  };

  return <div className="featurePage openingPage"><div className="featureShell openingShell">
    <div className="openingHero"><div><div className="featureKicker">DORI CHESS · OPENING LAB</div><h1 className="featureTitle">오프닝 학습실</h1><p className="featureSub">대표적인 오프닝의 기본 수순과 전략적 아이디어를 직접 따라 두며 익혀보세요.</p></div><div className="openingProgressBadge"><span>완료한 학습</span><b>{Object.values(progress).reduce((sum,row) => sum + Number(row.completed_count || 0),0)}</b></div></div>
    <div className="openingLayout">
      <aside className="openingCatalog">
        <div className="openingCatalogHead"><span>OPENING LIBRARY</span><h2>학습 코스</h2></div>
        <div className="openingFilters">{["전체","오픈 게임","비대칭 오프닝","퀸즈 폰 게임"].map(name=><button key={name} className={filter===name?"active":""} onClick={()=>setFilter(name)}>{name}</button>)}</div>
        <div className="openingCourseList">{filtered.map(item=><button key={item.id} className={openingId===item.id?"selected":""} onClick={()=>setOpeningId(item.id)}><span className="openingCourseIcon">♞</span><span className="openingCourseText"><b>{item.name}</b><small>{item.family} · {item.level}</small></span><em>{progress[item.id]?.completed_count ? `완료 ${progress[item.id].completed_count}` : "학습 시작"}</em></button>)}</div>
      </aside>
      <main className="openingWorkspace">
        <div className="openingLessonHead"><div><span>{opening.family} · {opening.level}</span><h2>{opening.name}</h2><p>{opening.goal}</p></div><div className="openingPlyCounter"><b>{moveLog.length}</b><small>/ {opening.moves.length} ply</small></div></div>
        <div className="openingGameGrid">
          <div className="openingBoardArea">
            <div className="openingBoardFrame"><div className="openingBoard">{Array.from({length:64},(_,index)=>{const row=Math.floor(index/8),col=index%8,square=`abcdefgh`[col]+(8-row),piece=game.get(square),light=(row+col)%2===0,isTarget=legalTargets.includes(square),isLast=last && (last.slice(0,2)===square||last.slice(2,4)===square);return <button key={square} className={`openingSquare ${light?"light":"dark"} ${selected===square?"selected":""} ${isTarget?"target":""} ${isLast?"last":""}`} onClick={()=>clickSquare(square)} aria-label={square}>{piece&&<img src={pieceSrc(piece)} alt={`${piece.color==="w"?"백":"흑"} ${piece.type}`}/>}{isTarget&&!piece&&<i/>}{col===0&&<small className="rankLabel">{8-row}</small>}{row===7&&<small className="fileLabel">{`abcdefgh`[col]}</small>}</button>;})}</div></div>
            <div className="openingControls"><button onClick={undo} disabled={!moveLog.length}>← 한 수 되돌리기</button><button onClick={playRecommended} disabled={!expected||!onLine}>추천 수 놓기</button><button onClick={restart}>처음부터</button></div>
          </div>
          <section className="openingCoach">
            <div className="openingCoachCard"><span className="coachLabel">NEXT IDEA</span><h3>{expected && onLine ? (game.turn()==="w"?"다음 수를 직접 놓아보세요":"다음 수를 이어서 확인하세요") : complete ? "수순 학습 완료" : "자유 연습 중"}</h3><p>{expected && onLine ? opening.lesson[moveLog.length] : complete ? "준비된 주요 수순을 모두 진행했습니다. 이제 핵심 아이디어를 정리해 보세요." : "준비된 수순에서 벗어났습니다. 보드에서 합법적인 수를 계속 연습하거나 다시 시작할 수 있어요."}</p><div className="openingCoachHint">{expected && onLine ? `추천 수: ${expected.slice(0,2)} → ${expected.slice(2,4)}` : "합법적인 수만 둘 수 있습니다."}</div></div>
            <div className="openingIdea"><span>STRATEGIC IDEA</span><p>{opening.idea}</p></div>
            <div className="openingLessonStatus">{complete?<b className="complete">✓ 학습 수순을 완료했습니다</b>:<b>{onLine?"수순을 따라가는 중":"자유 연습 중"}</b>}<small>{saving?"진도 저장 중…":saveMessage || (user?"학습 진도는 계정에 저장됩니다.":"로그인하면 학습 진도를 계정에 저장할 수 있습니다.")}</small></div>
            <div className="openingStatusMessage">{message}</div>
          </section>
        </div>
      </main>
    </div>
    <div className="openingFooterLinks"><Link to="/">AI 대국으로 →</Link><Link to="/stats">전적 및 통계 →</Link></div>
  </div></div>;
}
