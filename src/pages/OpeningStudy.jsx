import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { supabase } from "../supabase";
import "../styles/feature.css";
import "./OpeningStudy.css";

export const OPENINGS = [
  { id:"italian", name:"이탈리안 게임", family:"오픈 게임", level:"초급", moves:["e2e4","e7e5","g1f3","b8c6","f1c4"], lesson:["중앙 공간을 확보하고 비숍의 길을 엽니다.","흑도 중앙을 차지해 균형을 맞춥니다.","나이트를 전개하면서 e5 폰을 공격합니다.","나이트를 전개해 e5를 지킵니다.","비숍을 c4에 두어 f7을 압박합니다."], goal:"빠른 기물 전개와 중앙 장악의 기본을 익힙니다.", idea:"중앙 폰을 전진시키고, 나이트와 비숍을 자연스럽게 전개한 뒤 안전하게 캐슬링하는 것이 핵심입니다." },
  { id:"sicilian", name:"시실리안 디펜스", family:"비대칭 오프닝", level:"중급", moves:["e2e4","c7c5","g1f3","d7d6","d2d4","c5d4","f3d4","g8f6"], lesson:["백은 e4로 중앙을 차지합니다.","흑은 c5로 비대칭적인 중앙 구조를 만듭니다.","나이트를 전개해 d4와 e5를 지원합니다.","d6로 e5를 통제하고 구조를 안정시킵니다.","백은 d4로 중앙을 열어 전개 속도를 얻습니다.","흑은 cxd4로 중앙 폰을 교환합니다.","나이트로 되잡아 중앙에 기물을 배치합니다.","흑은 나이트를 전개하며 e4를 압박합니다."], goal:"비대칭 폰 구조와 적극적인 반격 아이디어를 배웁니다.", idea:"시실리안은 양쪽의 폰 구조가 달라지는 오프닝입니다. 백은 공간과 전개, 흑은 반격 기회를 노리는 경우가 많습니다." },
  { id:"queens-gambit", name:"퀸즈 갬빗", family:"퀸즈 폰 게임", level:"초급", moves:["d2d4","d7d5","c2c4","e7e6","b1c3","g8f6","c1g5","f8e7"], lesson:["d4로 중앙을 차지하고 퀸즈 폰 구조를 시작합니다.","흑은 d5로 중앙을 맞섭니다.","c4로 d5 폰에 압박을 가합니다.","e6로 중앙을 지키고 비숍의 길을 엽니다.","나이트를 전개해 d5를 압박합니다.","흑도 나이트를 전개해 중앙을 지킵니다.","비숍을 전개해 f6 나이트를 핀합니다.","흑은 비숍을 전개해 핀을 풀 준비를 합니다."], goal:"폰 교환, 중앙 압박, 기물 전개의 관계를 이해합니다.", idea:"c4 폰은 무조건 희생하는 수라기보다 d5에 압박을 가하는 선택입니다. 중앙을 둘러싼 기물 배치가 중요합니다." },
  { id:"ruy-lopez", name:"루이 로페즈", family:"오픈 게임", level:"중급", moves:["e2e4","e7e5","g1f3","b8c6","f1b5","a7a6","b5a4","g8f6"], lesson:["e4로 중앙을 차지합니다.","e5로 중앙에 맞섭니다.","나이트를 전개하고 e5를 공격합니다.","나이트를 전개해 e5를 방어합니다.","비숍을 b5로 전개해 c6 나이트를 압박합니다.","a6로 비숍에게 결정을 요구합니다.","비숍은 a4로 물러나 압박을 유지합니다.","흑은 나이트를 전개해 중앙을 공격합니다."], goal:"기물 압박과 템포, 비숍의 후퇴 개념을 익힙니다.", idea:"루이 로페즈는 e5 중앙 구조에 지속적인 압박을 가하는 대표적인 오픈 게임 오프닝입니다." }
];

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
