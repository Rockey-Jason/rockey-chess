import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Chess } from "chess.js";
import "../styles/feature.css";

const QUALITY_LABELS = {
  brilliant: "최고의 수",
  great: "훌륭한 수",
  best: "최선",
  excellent: "정확한 수",
  good: "좋은 수",
  inaccuracy: "부정확",
  mistake: "실수",
  blunder: "큰 실수",
  miss: "기회 놓침",
  book: "이론 수",
  forced: "강제 수",
};

const QUALITY_DESCRIPTIONS = {
  brilliant: "어려운 희생이나 전환을 정확하게 찾아낸 인상적인 수입니다.",
  great: "포지션의 핵심을 잘 이해하고 최선에 가깝게 둔 수입니다.",
  best: "이 포지션에서 엔진이 선택한 최선의 수입니다.",
  excellent: "최선과 매우 가까운 정확한 선택입니다.",
  good: "건전한 수입니다. 더 정밀한 선택지도 있었습니다.",
  inaccuracy: "작은 평가 손실이 생겼습니다. 다음에는 더 나은 선택을 찾아보세요.",
  mistake: "눈에 띄는 평가 손실이 발생한 수입니다.",
  blunder: "포지션을 크게 악화시킨 수입니다. 놓친 전술을 살펴보세요.",
  miss: "공격 기회나 중요한 대응 기회를 놓친 수입니다.",
  book: "오프닝 이론 수순에 포함된 수입니다.",
  forced: "실질적으로 선택지가 거의 하나였던 강제 수입니다.",
};

const CRITICAL_QUALITIES = new Set(["inaccuracy", "mistake", "blunder", "miss"]);
const GOOD_QUALITIES = new Set(["brilliant", "great", "best", "excellent", "good"]);
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function formatEvaluation(move) {
  if (move?.mate && Number.isFinite(Number(move.mate.moves))) {
    const sign = move.mate.winner === "black" ? "−" : "+";
    return sign + "M" + Math.abs(Number(move.mate.moves));
  }
  const score = Number(move?.evaluation);
  if (!Number.isFinite(score)) return "—";
  return (score > 0 ? "+" : "") + score.toFixed(2);
}

export function filterAnalysisMoves(moves = [], filter = "all") {
  return moves
    .map((move, index) => ({ move, index }))
    .filter(({ move }) => {
      if (filter === "critical") return CRITICAL_QUALITIES.has(move.quality);
      if (filter === "good") return GOOD_QUALITIES.has(move.quality);
      return true;
    });
}

function parseReview(pgn, ply) {
  const fallback = new Chess();
  if (!pgn) return { game: fallback, history: [], headers: {}, move: null, error: "" };
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const history = game.history({ verbose: true });
    const headers = game.getHeaders();
    const targetPly = Math.max(0, Math.min(history.length, Number(ply) || 0));
    for (let index = history.length; index > targetPly; index -= 1) game.undo();
    return {
      game,
      history,
      headers,
      move: targetPly > 0 ? history[targetPly - 1] : null,
      error: "",
    };
  } catch (error) {
    return { game: fallback, history: [], headers: {}, move: null, error: error?.message || "기보를 읽지 못했습니다." };
  }
}

function sanForUci(pgn, ply, uci) {
  if (!pgn || !uci || String(uci).length < 4) return "—";
  try {
    const review = parseReview(pgn, Math.max(0, ply - 1));
    const game = review.game;
    const result = game.move({
      from: String(uci).slice(0, 2),
      to: String(uci).slice(2, 4),
      ...(String(uci).length > 4 ? { promotion: String(uci)[4] } : {}),
    });
    return result?.san || String(uci);
  } catch {
    return String(uci);
  }
}

const QUALITY_GLYPHS = {
  brilliant: "✦",
  great: "★",
  best: "✓",
  excellent: "◎",
  good: "+",
  inaccuracy: "!",
  mistake: "⚠",
  blunder: "×",
  miss: "?",
  book: "B",
  forced: "=",
};

const QUALITY_COLORS = {"brilliant":"#ffd977","great":"#70e2ff","best":"#8fdaa7","excellent":"#78cfaf","good":"#84b7e8","inaccuracy":"#f0cf72","mistake":"#f2a66e","blunder":"#ff7774","miss":"#cc9bff","book":"#a9b8ca","forced":"#b8c3d2"};

export function buildBoardRouteMap(moves = []) {
  const originCounts = new Map();
  const destinationCounts = new Map();

  return moves.flatMap((move, index) => {
    // The board overlay is a review of the human player's own moves only.
    // Keep the original full-analysis index so selecting a marker navigates
    // to the matching ply in the move list and position review.
    if (move?.side !== "player") return [];

    const uci = String(move?.uci || "").toLowerCase();
    const from = String(move?.from || uci.slice(0, 2)).toLowerCase();
    const to = String(move?.to || uci.slice(2, 4)).toLowerCase();
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return [];

    const fromFile = FILES.indexOf(from[0]);
    const fromRank = 8 - Number(from[1]);
    const toFile = FILES.indexOf(to[0]);
    const toRank = 8 - Number(to[1]);
    const originStack = originCounts.get(from) || 0;
    const destinationStack = destinationCounts.get(to) || 0;
    originCounts.set(from, originStack + 1);
    destinationCounts.set(to, destinationStack + 1);

    return [{
      move,
      index,
      from,
      to,
      fromX: (fromFile + 0.5) * 100,
      fromY: (fromRank + 0.5) * 100,
      toX: (toFile + 0.5) * 100,
      toY: (toRank + 0.5) * 100,
      fromLeft: (fromFile * 12.5 + 1.6),
      fromTop: (fromRank * 12.5 + 7.5),
      toLeft: (toFile * 12.5 + 7),
      toTop: (toRank * 12.5 + 7),
      originStack,
      destinationStack,
      quality: QUALITY_COLORS[move?.quality] ? move.quality : "good",
    }];
  });
}

function ReviewBoard({ review, ply, moves = [], selectedIndex = -1, onSelectMove }) {
  const [phase, setPhase] = useState("start");
  const move = review.move;
  const board = review.game.board();
  const routes = useMemo(() => buildBoardRouteMap(moves), [moves]);

  useEffect(() => {
    if (!move) {
      setPhase("done");
      return undefined;
    }
    setPhase("start");
    const frame = window.requestAnimationFrame(() => setPhase("move"));
    const timer = window.setTimeout(() => setPhase("done"), 430);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [move?.from, move?.to, ply]);

  const fromFile = move ? FILES.indexOf(move.from[0]) : 0;
  const fromRank = move ? 8 - Number(move.from[1]) : 0;
  const toFile = move ? FILES.indexOf(move.to[0]) : 0;
  const toRank = move ? 8 - Number(move.to[1]) : 0;
  return (
    <div className="studioBoardFrame">
      <div className="studioBoard" role="group" aria-label={ply ? (ply + "번째 수 이후 체스판과 전체 이동 경로") : "시작 포지션과 전체 이동 경로"}>
        {board.map((rank, row) => rank.map((piece, col) => {
          const square = FILES[col] + (8 - row);
          const light = (row + col) % 2 === 0;
          const isFrom = move?.from === square;
          const isTo = move?.to === square;
          const hideDestination = move && isTo && phase !== "done";
          return (
            <div key={square} className={"studioSquare " + (light ? "light" : "dark") + (isFrom || isTo ? " moveHighlight" : "")} aria-hidden="true">
              {piece && !hideDestination && (
                <img
                  className="studioPiece"
                  src={import.meta.env.BASE_URL + "pieces/" + piece.color + piece.type.toUpperCase() + ".png"}
                  alt=""
                />
              )}
              {col === 0 && <span className="studioRank">{8 - row}</span>}
              {row === 7 && <span className="studioFile">{FILES[col]}</span>}
            </div>
          );
        }))}

        <svg className="studioBoardRoutes" viewBox="0 0 800 800" preserveAspectRatio="none" aria-label="전체 수 이동 경로">
          <defs>
            {Object.entries(QUALITY_COLORS).map(([quality, color]) => (
              <marker key={quality} id={"studioArrow-" + quality} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L7,3.5 L0,7 z" fill={color} />
              </marker>
            ))}
          </defs>
          {routes.map(route => {
            const label = QUALITY_LABELS[route.move.quality] || route.move.quality || "분석";
            const description = `${route.move.ply || route.index + 1}번째 수 · ${route.from} → ${route.to} · ${label} · ${formatEvaluation(route.move)}`;
            return (
              <path
                key={"route-" + route.index}
                className={"studioRoutePath quality-" + route.quality + (route.index === selectedIndex ? " active" : "")}
                d={`M ${route.fromX} ${route.fromY} L ${route.toX} ${route.toY}`}
                markerEnd={"url(#studioArrow-" + route.quality + ")"}
                style={{ "--route-color": QUALITY_COLORS[route.quality] }}
                onClick={() => onSelectMove?.(route.index)}
                role="button"
                tabIndex={0}
                aria-label={description}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectMove?.(route.index);
                  }
                }}
              />
            );
          })}
        </svg>

        {routes.map(route => {
          const moveNo = route.move.ply || route.index + 1;
          const qualityLabel = QUALITY_LABELS[route.move.quality] || route.move.quality || "분석";
          const description = `${moveNo}번째 수 ${route.from}에서 ${route.to} · ${qualityLabel} · 평가 ${formatEvaluation(route.move)}`;
          return (
            <span
              key={"origin-" + route.index}
              className={"studioOriginMarker" + (route.index === selectedIndex ? " active" : "")}
              style={{
                left: route.fromLeft + "%",
                top: route.fromTop + "%",
                "--route-color": QUALITY_COLORS[route.quality],
              }}
              title={description}
              aria-hidden="true"
            >
              {moveNo}
            </span>
          );
        })}

        {routes.map(route => {
          const moveNo = route.move.ply || route.index + 1;
          const qualityLabel = QUALITY_LABELS[route.move.quality] || route.move.quality || "분석";
          const description = `${moveNo}번째 수: ${route.from} → ${route.to}, ${qualityLabel}, 평가 ${formatEvaluation(route.move)}`;
          return (
            <button
              key={"destination-" + route.index}
              type="button"
              className={"studioDestinationBadge quality-" + route.quality + (route.index === selectedIndex ? " active" : "")}
              style={{
                left: route.toLeft + "%",
                top: route.toTop + "%",
                "--destination-offset-x": (route.destinationStack * 4) + "px",
                "--destination-offset-y": (Math.floor(route.destinationStack / 3) * 4) + "px",
                "--route-color": QUALITY_COLORS[route.quality],
              }}
              onClick={() => onSelectMove?.(route.index)}
              title={description}
              aria-label={description + " 선택"}
              aria-pressed={route.index === selectedIndex}
            >
              <b>{QUALITY_GLYPHS[route.move.quality] || "·"}</b>
              <small>{moveNo}</small>
            </button>
          );
        })}

        {move && phase !== "done" && (
          <img
            key={ply + "-" + move.from + "-" + move.to}
            className={"studioMovingPiece " + (phase === "move" ? "moving" : "")}
            src={import.meta.env.BASE_URL + "pieces/" + move.color + move.piece.toUpperCase() + ".png"}
            alt=""
            style={{
              "--from-x": fromFile,
              "--from-y": fromRank,
              "--to-x": toFile,
              "--to-y": toRank,
            }}
          />
        )}
      </div>

      <div className="studioBoardRouteGuide">
        <span className="studioRouteGuideTitle">전체 기보 경로</span>
        <span>출발 칸의 번호 → 도착 칸의 평가 아이콘</span>
        <span>화살표나 아이콘을 누르면 해당 수를 선택합니다</span>
      </div>
      <div className="studioRouteLegend" aria-label="평가 아이콘 범례">
        {["brilliant", "great", "best", "excellent", "good", "inaccuracy", "mistake", "blunder", "miss", "book", "forced"].map(quality => (
          <span
            key={quality}
            className={"studioRouteLegendItem quality-" + quality}
            style={{ "--route-color": QUALITY_COLORS[quality] }}
          >
            <b>{QUALITY_GLYPHS[quality]}</b><small>{QUALITY_LABELS[quality]}</small>
          </span>
        ))}
      </div>

      <div className="studioBoardCaption">
        <span>{review.headers?.White || "백"} · 백</span>
        <span className="studioBoardDot">●</span>
        <span>{review.headers?.Black || "흑"} · 흑</span>
        <span className="studioBoardPly">{ply ? "MOVE " + Math.ceil(ply / 2) : "START POSITION"}</span>
      </div>
    </div>
  );
}

function EvaluationTimeline({ moves, selected, onSelect }) {
  if (!moves.length) return null;
  const width = 1000;
  const height = 112;
  const left = 12;
  const right = width - 12;
  const top = 10;
  const bottom = height - 12;
  const span = Math.max(1, moves.length - 1);
  const yFor = (move) => {
    let value = Number(move?.evaluation);
    if (move?.mate) value = move.mate.winner === "black" ? -9 : 9;
    if (!Number.isFinite(value)) value = 0;
    const clamped = Math.max(-8, Math.min(8, value));
    return top + ((8 - clamped) / 16) * (bottom - top);
  };
  const xFor = (index) => left + (index / span) * (right - left);
  const points = moves.map((move, index) => xFor(index) + "," + yFor(move)).join(" ");
  const active = moves[selected] || moves[0];
  const activeX = xFor(selected);
  const activeY = yFor(active);

  return (
    <div className="studioTimeline">
      <div className="studioTimelineLegend">
        <span>백 우세 <b>+8</b></span>
        <span>균형 <b>0</b></span>
        <span>흑 우세 <b>−8</b></span>
      </div>
      <svg className="studioEvalGraph" viewBox={"0 0 " + width + " " + height} preserveAspectRatio="none" role="img" aria-label="경기 전체의 평가 변화 그래프">
        <line x1={left} y1={top} x2={right} y2={top} className="graphGridLine" />
        <line x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} className="graphZeroLine" />
        <line x1={left} y1={bottom} x2={right} y2={bottom} className="graphGridLine" />
        <polyline points={points} className="graphLine" />
        <line x1={activeX} y1={top} x2={activeX} y2={bottom} className="graphCursor" />
        <circle cx={activeX} cy={activeY} r="7" className="graphActivePoint" />
      </svg>
      <input
        className="studioTimelineRange"
        type="range"
        min="0"
        max={Math.max(0, moves.length - 1)}
        value={selected}
        onChange={(event) => onSelect(Number(event.target.value))}
        disabled={moves.length < 2}
        aria-label="기보 수순 이동"
      />
      <div className="studioTimelineEnds"><span>경기 시작</span><span>{moves.length} ply</span><span>경기 종료</span></div>
    </div>
  );
}

export default function AnalysisModal({
  open,
  onClose,
  onRetry,
  moves = [],
  pgn = "",
  accuracy = 0,
  loading = false,
  error = "",
  progress = { completed: 0, total: 0, currentMove: 0, percent: 0 },
}) {
  const [selected, setSelected] = useState(Math.max(0, moves.length - 1));
  const [filter, setFilter] = useState("all");
  const [copyMessage, setCopyMessage] = useState("");
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const selectedRowRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const moveCountRef = useRef(moves.length);
  onCloseRef.current = onClose;
  moveCountRef.current = moves.length;

  useEffect(() => {
    setSelected(Math.max(0, moves.length - 1));
    setFilter("all");
  }, [pgn, moves.length]);

  const visibleMoves = useMemo(() => filterAnalysisMoves(moves, filter), [moves, filter]);
  const active = moves[selected] || null;
  const activePly = active?.ply || 0;
  const review = useMemo(() => parseReview(pgn, activePly), [pgn, activePly]);
  const suggestedSan = useMemo(() => active ? sanForUci(pgn, active.ply || 0, active.bestMove) : "—", [active, pgn]);
  const counts = useMemo(() => moves.reduce((result, move) => {
    result[move.quality] = (result[move.quality] || 0) + 1;
    return result;
  }, {}), [moves]);
  const criticalCount = moves.filter((move) => CRITICAL_QUALITIES.has(move.quality)).length;
  const averageCpl = moves.length
    ? Math.round(moves.reduce((sum, move) => sum + (Number(move.cpl) || 0), 0) / moves.length)
    : 0;
  const safeAccuracy = Number.isFinite(Number(accuracy)) ? Math.max(0, Math.min(100, Number(accuracy))) : 0;
  const showcaseQuality = ["brilliant", "great", "blunder"].includes(active?.quality) ? active.quality : "";

  const goTo = useCallback((index) => {
    if (!moves.length) return;
    setSelected(Math.max(0, Math.min(moves.length - 1, index)));
  }, [moves.length]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll(
            'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
          ) || []
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      const target = event.target;
      const isInteractive = target instanceof HTMLElement &&
        (target.matches("input, button, textarea, select, summary, a") || target.isContentEditable);
      if (isInteractive || !moveCountRef.current) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelected(current => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelected(current => Math.min(moveCountRef.current - 1, current + 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setSelected(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setSelected(Math.max(0, moveCountRef.current - 1));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current instanceof HTMLElement && previousFocusRef.current !== document.body) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    selectedRowRef.current?.scrollIntoView?.({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, [selected, filter, open]);

  const copyPgn = async () => {
    if (!pgn) {
      setCopyMessage("복사할 기보가 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(pgn);
      setCopyMessage("PGN을 복사했습니다.");
    } catch {
      setCopyMessage("클립보드 접근이 차단되었습니다. PGN 텍스트를 직접 선택해 복사해 주세요.");
    }
  };

  const downloadPgn = () => {
    if (!pgn) return;
    const blob = new Blob([pgn], { type: "application/x-chess-pgn;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dori-chess-review.pgn";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="analysisBackdrop analysisStudioBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section ref={dialogRef} className="analysisStudio" role="dialog" aria-modal="true" aria-labelledby="analysis-studio-title">
        <header className="studioHeader">
          <div className="studioBrand">
            <div className="studioBrandMark">♞</div>
            <div>
              <span className="studioEyebrow">DORI CHESS · STOCKFISH 18 REVIEW</span>
              <h2 id="analysis-studio-title">경기 분석실</h2>
              <p>수순을 이동하며 평가 변화와 중요한 순간을 한 화면에서 확인하세요.</p>
            </div>
          </div>
          <button ref={closeRef} className="studioClose" onClick={onClose} aria-label="분석실 닫기">
            <span aria-hidden="true">×</span><small>닫기</small>
          </button>
        </header>

        <div className="studioSummary">
          <div className="studioSummaryCard studioAccuracyCard">
            <span>나의 정확도</span>
            <strong>{safeAccuracy.toFixed(1)}<small>%</small></strong>
            <i style={{ "--accuracy": safeAccuracy + "%" }} />
          </div>
          <div className="studioSummaryCard">
            <span>분석한 수</span>
            <strong>{moves.length}<small> ply</small></strong>
          </div>
          <div className="studioSummaryCard">
            <span>주의할 수</span>
            <strong className={criticalCount ? "studioWarningValue" : ""}>{criticalCount}<small> 개</small></strong>
          </div>
          <div className="studioSummaryCard">
            <span>평균 CPL</span>
            <strong>{averageCpl}<small> cp</small></strong>
          </div>
          <div className="studioQualitySummary" aria-label="수 분류 통계">
            {["brilliant", "great", "best", "good", "inaccuracy", "mistake", "blunder"].map((quality) => (
              <span key={quality} className={"studioQualityCount quality-" + quality} title={QUALITY_LABELS[quality]}>
                <b>{counts[quality] || 0}</b><small>{QUALITY_LABELS[quality]}</small>
              </span>
            ))}
          </div>
        </div>

        {loading && (
          <div className="studioProgress" role="status" aria-live="polite">
            <div className="studioProgressTop">
              <div><b>Stockfish가 경기를 분석하고 있어요</b><span>{progress.currentMove ? progress.currentMove + "수째 분석 중" : "포지션을 준비하고 있습니다"}</span></div>
              <strong>{Math.round(Number(progress.percent) || 0)}%</strong>
            </div>
            <div className="studioProgressTrack"><i style={{ width: Math.max(0, Math.min(100, Number(progress.percent) || 0)) + "%" }} /></div>
            <small>{progress.completed || 0} / {progress.total || moves.length || "—"} 수 분석 완료 · 창을 닫아도 분석은 계속 진행됩니다.</small>
          </div>
        )}

        {error && !loading && (
          <div className="studioError" role="alert">
            <div><b>분석을 완료하지 못했어요.</b><p>{error}</p></div>
            <button onClick={onRetry}>다시 분석</button>
          </div>
        )}

        {!loading && !error && moves.length > 0 && (
          <EvaluationTimeline moves={moves} selected={selected} onSelect={goTo} />
        )}

        {loading && moves.length === 0 ? (
          <div className="studioLoadingState">
            <div className="studioLoadingOrb" />
            <h3>경기 전체를 살펴보는 중</h3>
            <p>기물의 위치와 각 수의 선택지를 비교하고 있습니다.</p>
          </div>
        ) : !loading && !error && moves.length === 0 ? (
          <div className="studioEmpty">
            <span>♟</span><h3>분석할 수가 없습니다.</h3><p>이번 경기의 기보가 비어 있거나 저장되지 않았습니다.</p>
          </div>
        ) : !loading && !error && active ? (
          <div className="studioWorkspace">
            <section className="studioMovePanel" aria-label="수순 목록">
              <div className="studioPanelHeader">
                <div><span>MOVE EXPLORER</span><h3>전체 수순</h3></div>
                <b>{moves.length} ply</b>
              </div>
              <div className="studioMoveFilters" role="group" aria-label="수순 필터">
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체 <b>{moves.length}</b></button>
                <button className={filter === "critical" ? "active" : ""} onClick={() => setFilter("critical")}>주의 <b>{criticalCount}</b></button>
                <button className={filter === "good" ? "active" : ""} onClick={() => setFilter("good")}>좋은 수 <b>{moves.filter((move) => GOOD_QUALITIES.has(move.quality)).length}</b></button>
              </div>
              <div className="studioMoveList">
                {visibleMoves.length ? visibleMoves.map(({ move, index }) => (
                  <button
                    key={(move.uci || move.san || "move") + "-" + index}
                    ref={index === selected ? selectedRowRef : null}
                    className={"studioMoveRow " + (index === selected ? "active" : "") + (CRITICAL_QUALITIES.has(move.quality) ? " critical" : "") + (["brilliant", "great", "blunder"].includes(move.quality) ? " spotlight-" + move.quality : "")}
                    onClick={() => goTo(index)}
                    aria-pressed={index === selected}
                  >
                    <span className="studioMoveNo">{Math.ceil((move.ply || index + 1) / 2)}{move.side === "bot" ? "…" : "."}</span>
                    <b className="studioMoveSan">{move.san || "—"}</b>
                    <span className={"studioMoveQuality quality-" + move.quality}>{QUALITY_LABELS[move.quality] || move.quality || "분석"}</span>
                    <span className="studioMoveEval">{formatEvaluation(move)}</span>
                  </button>
                )) : (
                  <div className="studioNoFilteredMoves">이 필터에 해당하는 수가 없습니다.</div>
                )}
              </div>
              <div className="studioMoveListHint">수순을 선택하거나 좌우 방향키로 이동할 수 있어요.</div>
            </section>

            <section className={"studioDetailPanel" + (showcaseQuality ? " qualityShowcasePanel qualityShowcasePanel-" + showcaseQuality : "")} aria-label="선택한 수 분석">
              {showcaseQuality && (
                <div
                  key={String(active.ply) + "-" + String(active.uci || active.san) + "-" + showcaseQuality}
                  className={"studioQualityShowcase studioQualityShowcase-" + showcaseQuality}
                  aria-hidden="true"
                >
                  <span className="studioQualityAura" />
                  <span className="studioQualityShockwave" />
                  <b className="studioQualityShowcaseLabel">
                    {showcaseQuality === "brilliant" ? "BRILLIANT!" : showcaseQuality === "great" ? "GREAT MOVE!" : "BLUNDER!"}
                  </b>
                  {Array.from({ length: 10 }, (_, index) => (
                    <i key={index} className={"studioQualitySpark spark-" + (index + 1)} />
                  ))}
                </div>
              )}
              <div className="studioDetailTop">
                <div><span>POSITION REVIEW · {Math.ceil(activePly / 2)}번째 수</span><h3>{active.san || "—"}</h3></div>
                <span className={"studioClassification quality-" + active.quality}>{QUALITY_LABELS[active.quality] || active.quality || "분석 완료"}</span>
              </div>

              <div className="studioReviewGrid">
                <ReviewBoard review={review} ply={activePly} moves={moves} selectedIndex={selected} onSelectMove={goTo} />
                <div className="studioEvaluationCard">
                  <span>현재 평가 · 백 기준</span>
                  <strong className={(active.mate ? active.mate.winner === "black" : Number(active.evaluation) < 0) ? "blackAdvantage" : "whiteAdvantage"}>{formatEvaluation(active)}</strong>
                  <div className="studioEvalMeter" aria-label="백과 흑의 평가 균형">
                    <i style={{ "--eval-position": (50 + Math.max(-8, Math.min(8, Number(active.evaluation) || 0)) / 16 * 100) + "%" }} />
                  </div>
                  <div className="studioEvalMeta"><span>{active.mate ? "체크메이트까지 " + active.mate.moves + "수" : "평가 손실"}</span><b>{Number(active.cpl || 0).toFixed(0)} CPL</b></div>
                  <div className="studioEvalMeta"><span>수 정확도</span><b>{Number(active.accuracy || 0).toFixed(1)}%</b></div>
                </div>
              </div>

              <div className="studioExplanation">
                <div className="studioExplanationHeading"><span>MOVE INSIGHT</span><small>{active.side === "bot" ? "흑의 수" : "백의 수"}</small></div>
                <p>{QUALITY_DESCRIPTIONS[active.quality] || "엔진이 계산한 포지션 평가입니다."}</p>
                <div className="studioBestMove"><span>엔진 추천 수</span><b>{suggestedSan}</b><code>{active.bestMove || "—"}</code></div>
              </div>

              <div className="studioNavigation">
                <button onClick={() => goTo(0)} disabled={selected === 0} aria-label="첫 수">⇤<small>처음</small></button>
                <button onClick={() => goTo(selected - 1)} disabled={selected === 0} aria-label="이전 수">←<small>이전 수</small></button>
                <div className="studioCurrentPly"><b>{selected + 1}</b><span>/ {moves.length}</span></div>
                <button onClick={() => goTo(selected + 1)} disabled={selected >= moves.length - 1} aria-label="다음 수">→<small>다음 수</small></button>
                <button onClick={() => goTo(moves.length - 1)} disabled={selected >= moves.length - 1} aria-label="마지막 수">⇥<small>마지막</small></button>
              </div>
            </section>
          </div>
        ) : null}

        <details className="studioPgn">
          <summary><span>기보 원문 보기</span><small>PGN · 클릭하여 펼치기</small></summary>
          <div className="studioPgnActions">
            <button onClick={copyPgn} disabled={!pgn}>기보 복사</button>
            <button onClick={downloadPgn} disabled={!pgn}>PGN 다운로드</button>
            {copyMessage && <span role="status">{copyMessage}</span>}
          </div>
          <pre>{pgn || "PGN 데이터가 없습니다."}</pre>
        </details>

        <footer className="studioFooter">
          <span>평가 그래프는 백 기준입니다. 위쪽은 백 우세, 아래쪽은 흑 우세를 뜻합니다.</span>
          <span>단축키: ← 이전 · → 다음 · Home 처음 · End 마지막 · Esc 닫기</span>
        </footer>
      </section>
    </div>,
    document.body
  );
}
