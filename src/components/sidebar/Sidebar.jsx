import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Sidebar.css";
import botData from "../../data/botData";
import AnalysisModal from "../AnalysisModal";

const req = {
    talc: 0,
    sleep: 100,
    fur: 300,
    rockey: 700,
    army: 1500,
    doronum: 3000,
    brilliant: 6000
};

const labels = {
    brilliant: "Brilliant",
    great: "Great",
    best: "Best",
    excellent: "Excellent",
    good: "Good",
    inaccuracy: "Inaccuracy",
    mistake: "Mistake",
    blunder: "Blunder",
    miss: "Miss",
    book: "Book",
    forced: "Forced"
};

const qualityOrder = [
    "brilliant",
    "great",
    "best",
    "excellent",
    "good",
    "inaccuracy",
    "mistake",
    "blunder",
    "miss",
    "book",
    "forced"
];

export default function Sidebar({ chess = {} }) {
    const [pendingAction, setPendingAction] = useState("");
    const cancelConfirmRef = useRef(null);
    const acceptConfirmRef = useRef(null);
    const historyRef = useRef(null);

    const {
        history = [],
        undoMove = () => {},
        resetGame = () => {},
        setBot = () => {},
        currentBot = "talc",
        rating = 0,
        accuracy = 100,
        moveStats = {},
        analysisMoves = [],
        lastAnalysis = null,
        isThinking = false,
        resign = () => {},
        offerDraw = () => {},
        downloadPGN = () => {},
        gameSummary = {},
        gameOver = false,
        matchLocked = false,
        analyzeGame = () => {},
        openAnalysis = analyzeGame,
        analysisOpen = false,
        setAnalysisOpen = () => {},
        analysisBusy = false,
        analysisError = "",
        analysisProgress = { completed: 0, total: 0, currentMove: 0, percent: 0 },
        rockKingCoin = 0
    } = chess;

    useEffect(() => {
        if (!pendingAction) return undefined;
        const frame = window.requestAnimationFrame(() => cancelConfirmRef.current?.focus());
        const onKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                setPendingAction("");
                return;
            }
            if (event.key !== "Tab") return;
            if (event.shiftKey && document.activeElement === cancelConfirmRef.current) {
                event.preventDefault();
                acceptConfirmRef.current?.focus();
            } else if (!event.shiftKey && document.activeElement === acceptConfirmRef.current) {
                event.preventDefault();
                cancelConfirmRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [pendingAction]);

    useEffect(() => {
        const element = historyRef.current;
        if (!element) return;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    }, [analysisMoves.length]);

    const confirmMessage = pendingAction === "resign"
        ? "기권하면 이번 대국은 패배로 기록되고 레이팅이 반영됩니다."
        : "무승부로 종료하면 이번 대국은 무승부로 기록되고 레이팅이 반영됩니다.";

    const confirmPendingAction = () => {
        if (pendingAction === "resign") resign();
        if (pendingAction === "draw") offerDraw();
        setPendingAction("");
    };

    return (
        <>
        <aside className="sidebar">
            <div className="sidebarTitle">
                <div>
                    <span className="eyebrow">ROCKEY CHESS</span>
                    <h2>Choose The Bot</h2>
                </div>
                {matchLocked && !gameOver && (
                    <span className="lockBadge">🔒 경기 중</span>
                )}
            </div>

            <div className="botList">
                {Object.keys(botData).map((id) => {
                    const lockedByRating = rating < req[id];
                    const lockedByGame = matchLocked;

                    return (
                        <button
                            key={id}
                            type="button"
                            disabled={lockedByRating || lockedByGame}
                            className={
                                currentBot === id
                                    ? "botButton activeBot"
                                    : "botButton"
                            }
                            onClick={() => setBot(id)}
                            aria-pressed={currentBot === id}
                            title={
                                lockedByGame
                                    ? "현재 대국이 끝난 후 AI를 변경할 수 있습니다."
                                    : lockedByRating
                                        ? `필요 레이팅: ${req[id].toLocaleString()}`
                                        : `${botData[id].name} 선택`
                            }
                        >
                            <img className="botPortrait" src={botData[id].image} alt="" loading="lazy" />
                            <span className="botInfo">
                                <b>{botData[id].name}</b>
                                <small>Lv.{botData[id].level} · {Number(botData[id].rating).toLocaleString()} 레이팅</small>
                            </span>
                            <span className="botAccess">
                                {currentBot === id ? "선택됨" : lockedByGame ? "대국 중" : lockedByRating ? `🔒 ${req[id].toLocaleString()}` : "선택"}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="sidebarDivider" />

            <div className="chessActions">
                <button
                    type="button"
                    className="actionButton"
                    onClick={undoMove}
                    disabled={isThinking || gameOver || history.length === 0}
                    title={history.length >= 2 ? "나와 AI의 마지막 수를 되돌립니다." : "첫 수를 되돌립니다."}
                >
                    ↩ 되돌리기
                </button>

                <button
                    className="actionButton"
                    onClick={resetGame}
                    disabled={matchLocked && !gameOver}
                >
                    ↻ 새 게임
                </button>

                <button
                    type="button"
                    className="actionButton danger"
                    onClick={() => setPendingAction("resign")}
                    disabled={!matchLocked || gameOver}
                    title={!matchLocked ? "한 수 이상 진행한 뒤 기권할 수 있습니다." : "현재 대국을 기권합니다."}
                >
                    🏳 기권
                </button>

                <button
                    type="button"
                    className="actionButton"
                    onClick={() => setPendingAction("draw")}
                    disabled={!matchLocked || gameOver}
                    title={!matchLocked ? "한 수 이상 진행한 뒤 무승부로 종료할 수 있습니다." : "현재 대국을 무승부로 종료합니다."}
                >
                    🤝 무승부 선언
                </button>
            </div>

            <div className="sidebarDivider" />

            <section className="analysisSection">
                <div className="sectionHeader">
                    <h3>분석</h3>
                    <strong>{accuracy}%</strong>
                </div>

                {lastAnalysis && (
                    <div
                        className={`analysisHero quality-${lastAnalysis.quality}`}
                    >
                        <div className="analysisHeroTop">
                            <span>
                                {labels[lastAnalysis.quality] ||
                                    lastAnalysis.quality}
                            </span>
                            <b>{lastAnalysis.san}</b>
                        </div>

                        <div className="analysisHeroBottom">
                            <span>정확도 {lastAnalysis.accuracy}%</span>
                            <span>
                                CPL {lastAnalysis.cpl}
                            </span>
                        </div>
                    </div>
                )}

                <div className="statsGrid">
                    {qualityOrder.map((key) => (
                        <div
                            className={`statCard quality-${key}`}
                            key={key}
                        >
                            <span>
                                {labels[key]}
                            </span>
                            <b>{moveStats[key] || 0}</b>
                        </div>
                    ))}
                </div>
            </section>

            <div className="sidebarDivider" />

            <section>
                <div className="sectionHeader">
                    <h3>기보</h3>
                    <span>{history.length} ply</span>
                </div>

                <div className="history" ref={historyRef} role="log" aria-label="대국 기보" aria-live="polite" aria-relevant="additions text">
                    {analysisMoves.length === 0 ? (
                        <div className="emptyHistory">
                            수를 두면 분석 결과가 표시됩니다.
                        </div>
                    ) : (
                        analysisMoves.map((move, index) => (
                            <div
                                className={`historyMove ${
                                    move.side === "player"
                                        ? "playerMove"
                                        : "botMove"
                                }`}
                                key={`${move.uci}-${index}`}
                            >
                                <span className="moveNo">
                                    {Math.ceil(move.ply / 2)}{move.side === "bot" ? "…" : "."}
                                </span>
                                <span className="moveSan">
                                    {move.san}
                                </span>
                                <span
                                    className={`moveBadge quality-${move.quality}`}
                                >
                                    {labels[move.quality] ||
                                        move.quality}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {history.length > 0 && (
                <button type="button" className="pgnButton" onClick={() => downloadPGN(gameSummary)} disabled={!gameSummary?.pgn}>
                    ↓ 기보 PGN 다운로드
                </button>
            )}

            {gameOver && (
                <div style={{display:"grid",gap:8,marginTop:12}}>
                    <button className="pgnButton" onClick={openAnalysis} disabled={analysisBusy}>{analysisBusy ? "⏳ 분석 준비 중…" : "📊 게임 분석하기"}</button>
                </div>
            )}
            <div className="coinMini">🪙 {Number(rockKingCoin).toLocaleString()} ROCK-KING-COIN</div>
            <AnalysisModal
                open={analysisOpen}
                onClose={() => setAnalysisOpen(false)}
                onRetry={openAnalysis}
                moves={analysisMoves}
                pgn={gameSummary?.pgn}
                accuracy={accuracy}
                loading={analysisBusy}
                error={analysisError}
                progress={analysisProgress}
            />
        </aside>
        {pendingAction && createPortal(
            <div className="sidebarConfirmBackdrop" onMouseDown={event => {
                if (event.target === event.currentTarget) setPendingAction("");
            }}>
                <section
                    className="sidebarConfirmDialog"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="chess-confirm-title"
                    aria-describedby="chess-confirm-description"
                >
                    <span className="sidebarConfirmIcon" aria-hidden="true">{pendingAction === "resign" ? "⚑" : "🤝"}</span>
                    <h2 id="chess-confirm-title">{pendingAction === "resign" ? "기권하시겠습니까?" : "무승부로 종료하시겠습니까?"}</h2>
                    <p id="chess-confirm-description">{confirmMessage}</p>
                    <div className="sidebarConfirmActions">
                        <button type="button" ref={cancelConfirmRef} className="confirmCancel" onClick={() => setPendingAction("")}>계속 대국하기</button>
                        <button type="button" ref={acceptConfirmRef} className={pendingAction === "resign" ? "confirmDanger" : "confirmAccept"} onClick={confirmPendingAction}>
                            {pendingAction === "resign" ? "기권 확정" : "무승부 확정"}
                        </button>
                    </div>
                </section>
            </div>,
            document.body
        )}
    </>
    );
}
