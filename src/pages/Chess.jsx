import { useEffect } from "react";
import "../App.css";
import TopBar from "../components/layout/TopBar";
import Sidebar from "../components/sidebar/Sidebar";
import Board from "../components/board/Board";
import useChessGame from "../hooks/useChessGame";

export default function Chess() {
    const chess = useChessGame();
    const { matchLocked, gameOver } = chess;

    /*
     * 경기 중에는 실수로 새로고침/닫기를 누르는 것을 막는다.
     * 브라우저 보안 정책상 실제 종료를 완전히 차단할 수는 없지만,
     * 대부분의 브라우저에서 확인창을 보여준다.
     */
    useEffect(() => {
        if (!matchLocked || gameOver) return undefined;

        const beforeUnload = (event) => {
            event.preventDefault();
            event.returnValue =
                "대결이 진행 중입니다. 정말 나가시겠습니까?";
        };

        window.addEventListener(
            "beforeunload",
            beforeUnload
        );

        return () => {
            window.removeEventListener(
                "beforeunload",
                beforeUnload
            );
        };
    }, [matchLocked, gameOver]);

    /*
     * 브라우저 뒤로가기 역시 경기 중에는 현재 게임으로 유지한다.
     */
    useEffect(() => {
        if (!matchLocked || gameOver) return undefined;

        const lockState = {
            rockeyChessMatch: true
        };

        window.history.pushState(
            lockState,
            "",
            window.location.href
        );

        const handlePopState = () => {
            window.history.pushState(
                lockState,
                "",
                window.location.href
            );
        };

        window.addEventListener(
            "popstate",
            handlePopState
        );

        return () => {
            window.removeEventListener(
                "popstate",
                handlePopState
            );
        };
    }, [matchLocked, gameOver]);

    return (
        <div className="app">
            <TopBar chess={chess} />

            <main className="layout">
                <Board chess={chess} />
                <Sidebar chess={chess} />
            </main>
        </div>
    );
}
