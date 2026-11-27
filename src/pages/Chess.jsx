import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import Sidebar from "../components/sidebar/Sidebar";
import Board from "../components/board/Board";
import AchievementToast from "../components/AchievementToast";
import useChessGame from "../hooks/useChessGame";
import { supabase } from "../supabase";

function ChessCommandCenter({ chess }) {
    const {
        currentBot = "talc",
        rating = 0,
        gameOver = false,
        isThinking = false,
        matchLocked = false,
        turn = "w"
    } = chess;
    const statusText = isThinking
        ? "AI 수 계산 중"
        : gameOver
            ? "대국 종료"
            : matchLocked
                ? turn === "w" ? "내 차례" : "AI 차례"
                : "대국 준비 완료";
    const botNames = { talc: "Talc", sleep: "Sleep", fur: "Fur", rockey: "ROCKEY", army: "Army", doronum: "Doronium", brilliant: "Brilliant" };
    return (
        <header className="chessCommandCenter">
            <div className="chessCommandTop">
                <div className="chessBrandLockup">
                    <div className="chessBrandMark">♞</div>
                    <div><span className="chessEyebrow">DOLDOL WORLD · STRATEGY ARENA</span><h1>돌이체스 <span>CHESS</span></h1></div>
                </div>
                <div className="chessCommandStatus" role="status" aria-live="polite">
                    <i className={isThinking ? "thinking" : gameOver ? "finished" : "ready"} />
                    {statusText}
                </div>
            </div>
            <div className="chessCommandBottom">
                <div className="chessCommandCopy">
                    <strong>{matchLocked && !gameOver ? (turn === "w" && !isThinking ? "당신의 다음 수를 기다리고 있어요." : "AI가 다음 수를 계산하고 있어요.") : "한 수 앞을 읽는 전략의 공간"}</strong>
                    <p>AI 대국과 실시간 대전, 오프닝 학습과 나의 기보를 한곳에서 관리하세요.</p>
                </div>
                <div className="chessQuickStats">
                    <div><span>선택한 AI</span><b>{botNames[currentBot] || currentBot}</b></div>
                    <div><span>나의 레이팅</span><b>{Number(rating).toLocaleString()}</b></div>
                </div>
            </div>
            <nav className="chessModeRail" aria-label="체스 모드">
                <Link className="chessMode active" to="/"><span>♟</span><b>AI 대국</b><small>혼자 연습하기</small></Link>
                <Link className="chessMode" to="/pvp"><span>⚔</span><b>실시간 대전</b><small>친구 · 랭크 매치</small><em>LIVE</em></Link>
                <Link className="chessMode" to="/openings"><span>♞</span><b>오프닝 학습</b><small>전략 익히기</small></Link>
                <Link className="chessMode" to="/stats"><span>▤</span><b>전적 · 통계</b><small>나의 기록</small></Link>
                <Link className="chessMode" to="/customize"><span>✦</span><b>체스 꾸미기</b><small>나만의 보드</small></Link>
                <Link className="chessMode" to="/shop"><span>◈</span><b>체스 상점</b><small>아이템 둘러보기</small></Link>
            </nav>
        </header>
    );
}

export default function Chess() {
    const chess = useChessGame();
    const { matchLocked, gameOver, achievementEvent, clearAchievementEvent } = chess;
    const missionSent = useRef(false);

    useEffect(() => {
        if (!gameOver || missionSent.current) return;
        missionSent.current = true;
        supabase.rpc("complete_daily_mission", { p_mission_key: "play_chess" })
            .then(({ error }) => {
                if (error) console.warn("Daily mission:", error.message);
            });
    }, [gameOver]);

    useEffect(() => {
        if (!matchLocked || gameOver) return undefined;
        const beforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "대결이 진행 중입니다. 정말 나가시겠습니까?";
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [matchLocked, gameOver]);

    useEffect(() => {
        if (!matchLocked || gameOver) return undefined;
        const lockState = { rockeyChessMatch: true };
        window.history.pushState(lockState, "", window.location.href);
        const handlePopState = () => window.history.pushState(lockState, "", window.location.href);
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [matchLocked, gameOver]);

    return (
        <div className="app">
            <AchievementToast achievement={achievementEvent} onClose={clearAchievementEvent} />
            <div className="chessPageIntro"><ChessCommandCenter chess={chess} /></div>
            <main className="layout">
                <Board chess={chess} />
                <Sidebar chess={chess} />
            </main>
        </div>
    );
}
