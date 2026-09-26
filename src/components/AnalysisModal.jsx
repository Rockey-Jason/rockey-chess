import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import "../styles/feature.css";

const labels = { brilliant:"Brilliant", great:"Great", best:"Best", excellent:"Excellent", good:"Good", inaccuracy:"Inaccuracy", mistake:"Mistake", blunder:"Blunder", miss:"Miss", book:"Book", forced:"Forced" };
const descriptions = {
  brilliant:"실전적으로 매우 어려운 희생·전환이면서 엔진상 큰 의미가 있는 수에만 부여됩니다.",
  great:"최선에 가까우면서 포지션의 핵심을 정확히 이해한 수입니다.", best:"현재 포지션에서 엔진이 선택한 최선의 수입니다.", excellent:"최선과 매우 가까운 정확한 선택입니다.", good:"건전한 수지만 더 정확한 선택지가 있었습니다.", inaccuracy:"작은 평가 손실이 발생했습니다.", mistake:"명확한 평가 손실이 발생했습니다.", blunder:"큰 평가 손실을 만들어 포지션을 크게 악화시켰습니다.", miss:"상대에게 유리한 기회 또는 자신의 기회를 놓쳤습니다.", book:"검증된 오프닝 이론 데이터베이스에 포함된 수입니다.", forced:"실질적으로 선택지가 거의 하나인 강제 수입니다."
};
const files = ["a","b","c","d","e","f","g","h"];

function positionAtPly(pgn, ply) {
  const game = new Chess();
  if (!pgn) return game;
  try {
    game.loadPgn(pgn);
    const moves = game.history({ verbose: true });
    const replay = new Chess();
    moves.slice(0, ply).forEach(m => replay.move(m));
    return replay;
  } catch { return game; }
}

function MiniBoard({ game }) {
  const cells = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (let fi = 0; fi < 8; fi++) {
      const square = files[fi] + rank;
      const piece = game.get(square);
      const light = (rank + fi) % 2 === 0;
      cells.push(<div key={square} className={`reviewSquare ${light ? "light" : "dark"}`}>
        {piece && <img src={`${import.meta.env.BASE_URL}pieces/${piece.color}${piece.type.toUpperCase()}.png`} alt="" />}
      </div>);
    }
  }
  return <div className="reviewBoard">{cells}</div>;
}

export default function AnalysisModal({ open, onClose, moves = [], pgn = "", accuracy = 0, loading = false }) {
  const [selected, setSelected] = useState(Math.max(0, moves.length - 1));
  useEffect(() => { setSelected(Math.max(0, moves.length - 1)); }, [moves.length]);
  const active = moves[selected] || null;
  const counts = useMemo(() => moves.reduce((a,m)=>{a[m.quality]=(a[m.quality]||0)+1;return a},{}), [moves]);
  const position = useMemo(() => positionAtPly(pgn, active?.ply || 0), [pgn, active?.ply]);
  if (!open) return null;
  return <div className="analysisBackdrop">
    <div className="analysisShell">
      <header className="analysisTop">
        <div><div className="analysisKicker">ROCKEY CHESS · GAME REVIEW</div><h2>게임 분석</h2><p>게임이 끝난 뒤에만 엔진 평가가 공개됩니다.</p></div>
        <button className="closeButton" onClick={onClose}>닫기</button>
      </header>
      <div className="analysisOverview">
        <div className="accuracyHero"><span>PLAYER ACCURACY</span><strong>{accuracy}%</strong></div>
        <div className="analysisCounts">{Object.entries(counts).map(([k,v])=><span key={k} className={`analysisPill quality-${k}`}>{labels[k]||k} <b>{v}</b></span>)}</div>
      </div>
      {loading ? <div className="analysisLoading"><div className="loadingOrb"/><h3>모든 수를 다시 계산하는 중…</h3><p>Stockfish 18이 각 포지션의 최선수와 실제 수의 차이를 비교하고 있습니다.</p></div> :
      <div className="analysisLayout">
        <section className="analysisMoves">
          <div className="analysisSectionTitle">수별 평가 · 클릭해서 포지션 보기</div>
          {moves.length === 0 ? <div className="emptyAnalysis">분석할 기보가 없습니다.</div> : moves.map((m,i)=><button key={`${m.uci}-${i}`} className={`analysisMoveRow ${selected===i?"active":""}`} onClick={()=>setSelected(i)}>
            <span className="moveIndex">{Math.ceil(m.ply/2)}{m.side==="bot"?"…":"."}</span><b>{m.san}</b><span className={`analysisQuality quality-${m.quality}`}>{labels[m.quality]||m.quality}</span><span className="moveCpl">{Number(m.evaluation||0)>0?"+":""}{Number(m.evaluation||0).toFixed(2)}</span>
          </button>)}
        </section>
        <section className="analysisDetail">
          {active ? <>
            <div className="reviewVisual"><MiniBoard game={position}/><div className="reviewEval"><span>ENGINE EVALUATION</span><strong>{Number(active.evaluation||0)>0?"+":""}{Number(active.evaluation||0).toFixed(2)}</strong><small>{active.cpl} CPL</small></div></div>
            <div className={`detailBadge quality-${active.quality}`}>{labels[active.quality]||active.quality}</div>
            <h3>{active.san}</h3><p>{descriptions[active.quality]||"엔진 분석 결과입니다."}</p>
            <div className="detailGrid"><div><span>정확도</span><b>{active.accuracy}%</b></div><div><span>CPL</span><b>{active.cpl}</b></div><div><span>최선수</span><b>{active.bestMove||"—"}</b></div><div><span>분류</span><b>{labels[active.quality]||active.quality}</b></div></div>
            <div className="reviewPager"><button disabled={selected<=0} onClick={()=>setSelected(v=>Math.max(0,v-1))}>← 이전 수</button><span>{selected+1} / {moves.length}</span><button disabled={selected>=moves.length-1} onClick={()=>setSelected(v=>Math.min(moves.length-1,v+1))}>다음 수 →</button></div>
          </> : <p>선택할 수가 없습니다.</p>}
        </section>
      </div>}
      <details className="pgnDetails"><summary>PGN 보기</summary><pre>{pgn||"PGN 없음"}</pre></details>
    </div>
  </div>;
}
