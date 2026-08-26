import { useMemo, useState } from "react";
import "../styles/feature.css";

const labels = { brilliant:"Brilliant", great:"Great", best:"Best", excellent:"Excellent", good:"Good", inaccuracy:"Inaccuracy", mistake:"Mistake", blunder:"Blunder", miss:"Miss", book:"Book", forced:"Forced" };
const descriptions = {
  brilliant:"정확한 희생 또는 매우 어려운 최선의 수로 판정된 경우에만 표시됩니다.",
  great:"강력한 실전적 선택입니다.", best:"엔진이 선택한 최선수입니다.", excellent:"거의 최선에 가까운 매우 좋은 수입니다.", good:"건전하고 실용적인 수입니다.", inaccuracy:"작은 평가 손실이 있습니다.", mistake:"유의미한 평가 손실이 발생했습니다.", blunder:"큰 평가 손실을 만든 수입니다.", miss:"기회를 놓친 수입니다.", book:"검증된 오프닝 이론에 포함되는 수입니다.", forced:"합법적인 선택지가 사실상 하나인 강제수입니다."
};

export default function AnalysisModal({ open, onClose, moves = [], pgn = "", accuracy = 0 }) {
  const [selected, setSelected] = useState(moves.length ? moves.length - 1 : 0);
  const active = moves[selected] || null;
  const counts = useMemo(() => moves.reduce((a,m)=>{a[m.quality]=(a[m.quality]||0)+1;return a},{}), [moves]);
  if (!open) return null;
  return <div className="analysisBackdrop"><div className="analysisShell">
    <header className="analysisTop"><div><div className="analysisKicker">ROCKEY CHESS · GAME REVIEW</div><h2>게임 분석</h2><p>Stockfish 18 기반 · 모든 수를 같은 기준으로 재검토했습니다.</p></div><button className="closeButton" onClick={onClose}>닫기</button></header>
    <div className="analysisOverview"><div className="accuracyHero"><span>정확도</span><strong>{accuracy}%</strong></div><div className="analysisCounts">{Object.entries(counts).map(([k,v])=><span key={k} className={`analysisPill quality-${k}`}>{labels[k]||k} <b>{v}</b></span>)}</div></div>
    <div className="analysisLayout"><section className="analysisMoves"><div className="analysisSectionTitle">수별 평가</div>{moves.map((m,i)=><button key={`${m.uci}-${i}`} className={`analysisMoveRow ${selected===i?"active":""}`} onClick={()=>setSelected(i)}><span className="moveIndex">{Math.ceil(m.ply/2)}{m.side==="bot"?"...":"."}</span><b>{m.san}</b><span className={`analysisQuality quality-${m.quality}`}>{labels[m.quality]||m.quality}</span><span className="moveCpl">{m.cpl} CPL</span></button>)}</section><section className="analysisDetail">{active?<><div className={`detailBadge quality-${active.quality}`}>{labels[active.quality]||active.quality}</div><h3>{active.san}</h3><p>{descriptions[active.quality]||"엔진 분석 결과입니다."}</p><div className="detailGrid"><div><span>정확도</span><b>{active.accuracy}%</b></div><div><span>CPL</span><b>{active.cpl}</b></div><div><span>최선수</span><b>{active.bestMove||"—"}</b></div><div><span>평가</span><b>{Number(active.evaluation||0)>0?"+":""}{Number(active.evaluation||0).toFixed(2)}</b></div></div><div className="pvHint">이 화면의 평가는 각 수를 두기 직전의 포지션과 둔 직후 포지션을 각각 엔진으로 계산해 비교합니다.</div></>:<p>분석할 수가 없습니다.</p>}</section></div>
    <details className="pgnDetails"><summary>PGN 보기</summary><pre>{pgn||"PGN 없음"}</pre></details>
  </div></div>;
}
