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
        analysisReady = false,
        doldolcoin = 0,
        rockKingCoin = 0
    } = chess;

    return (
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
                    const lockedByGame =
                        matchLocked && currentBot !== id;

                    return (
                        <button
                            key={id}
                            disabled={lockedByRating || lockedByGame}
                            className={
                                currentBot === id
                                    ? "botButton activeBot"
                                    : "botButton"
                            }
                            onClick={() => setBot(id)}
                            title={
                                lockedByGame
                                    ? "현재 대결이 끝난 후 선택할 수 있습니다."
                                    : undefined
                            }
                        >
                            <span>{botData[id].name}</span>
                            {lockedByRating && (
                                <small>⭐ {req[id]}</small>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="sidebarDivider" />

            <div className="chessActions">
                <button
                    className="actionButton"
                    onClick={undoMove}
                    disabled={isThinking || matchLocked}
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
                    className="actionButton danger"
                    onClick={resign}
                    disabled={isThinking || gameOver}
                >
                    🏳 기권
                </button>

                <button
                    className="actionButton"
                    onClick={offerDraw}
                    disabled={isThinking || gameOver}
                >
                    🤝 무승부
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

                <div className="history">
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
                                    {Math.ceil(move.ply / 2)}.
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

            {gameOver && (
                <div style={{display:"grid",gap:8,marginTop:12}}>
                    <button className="pgnButton" onClick={openAnalysis} disabled={analysisBusy}>{analysisBusy ? "⏳ 분석 준비 중…" : "📊 게임 분석하기"}</button>
                </div>
            )}
            <div className="coinMini">🪙 {Number(rockKingCoin).toLocaleString()} ROCK-KING-COIN</div>
            <AnalysisModal open={analysisOpen} onClose={()=>setAnalysisOpen(false)} moves={analysisMoves} pgn={gameSummary?.pgn} accuracy={accuracy} loading={analysisBusy}/>
        </aside>
    );
}
