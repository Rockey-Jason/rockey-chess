import "./Board.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

import Square from "./Square";
import Piece from "../Piece";
import SpeechBubble from "../SpeechBubble";
import botData from "../../data/botData";
import RatingChange from "../RatingChange";
import { supabase } from "../../supabase";
import { canStartPieceDrag, canCommitPieceDrag } from "./dragRules";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const pieceNames = { k: "킹", q: "퀸", r: "룩", b: "비숍", n: "나이트", p: "폰" };

const order = {
    Q: 0,
    R: 1,
    B: 2,
    N: 3,
    P: 4
};

const QUALITY_LABELS = {
    brilliant: "Brilliant",
    great: "Great",
    best: "Best",
    excellent: "Excellent",
    good: "Good",
    inaccuracy: "Inaccuracy",
    mistake: "Mistake",
    blunder: "Blunder",
    miss: "Miss"
};

export default function Board({ chess = {} }) {
    const boardRef = useRef(null);
    const gameOverRef = useRef(null);
    const boardBorderRef = useRef(null);
    const [hiddenSquares, setHiddenSquares] = useState([]);
    const [animations, setAnimations] = useState([]);
    const [focusedSquare, setFocusedSquare] = useState("e2");
    const promotionFirstRef = useRef(null);
    const previousFocusRef = useRef(null);
    const pointerFromRef = useRef(null);
    const pointerCanCommitRef = useRef(false);
    const suppressClickRef = useRef(false);
    const [customization, setCustomization] = useState({
        board_theme: "default",
        piece_theme: "default",
        move_effect: "default",
        avatar_frame: "default",
        title: "default",
        sound: "default"
    });

    const {
        position = "",
        selected = null,
        moves = [],
        clickSquare = () => {},
        lastMove = null,
        inCheck = false,
        checkSquare = null,
        gameOver = false,
        currentBot = "talc",
        rating = 0,
        ratingChange = 0,
        showRatingChange = false,
        dragMove = () => {},
        moveAnimations = [],
        promotionData,
        choosePromotion = () => {},
        capturedWhite = [],
        capturedBlack = [],
        materialScore = { white: 0, black: 0 },
        downloadPGN = () => {},
        gameSummary = {},
        dialog = "",
        winner = "",
        result = "",
        accuracy = 100,
        resetGame = () => {},
        analyzeGame = () => {},
        openAnalysis = analyzeGame,
        currentEvaluation = 0,
        playerProfile = { name: "나", rating: 0, image: "" },
        lastAnalysis = null,
        isThinking = false,
        turn = "w",
        history = [],
        clearSelection = () => {},
        cancelPromotion = () => {},
        undoMove = () => {},
        analysisBusy = false,
        analysisOpen = false
    } = chess;

    const profile = botData[currentBot] || botData.talc || {};
    const opponentStatus = gameOver
        ? "대국 종료"
        : isThinking
            ? "AI 수 계산 중"
            : turn === "b"
                ? "AI 차례"
                : "대기 중";
    const playerStatus = gameOver
        ? "대국 종료"
        : turn === "w" && !isThinking
            ? "내 차례"
            : "대기 중";
    useEffect(() => {
        if (!gameOver) {
            if (previousFocusRef.current?.isConnected) {
                previousFocusRef.current.focus({ preventScroll: true });
            } else {
                boardRef.current?.focus({ preventScroll: true });
            }
            previousFocusRef.current = null;
            return undefined;
        }
        // The analysis studio owns focus while it is open above the result dialog.
        if (analysisOpen) return undefined;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : boardRef.current;

        const focusTimer = window.setTimeout(() => {
            gameOverRef.current?.querySelector("button:not(:disabled)")?.focus();
        }, 80);

        const trapFocus = event => {
            if (event.key !== "Tab") return;
            const controls = Array.from(
                gameOverRef.current?.querySelectorAll("button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])") || []
            );
            if (!controls.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", trapFocus);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener("keydown", trapFocus);
        };
    }, [gameOver, analysisOpen]);


    useEffect(() => {
        let mounted = true;
        const loadCustomization = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !mounted) return;
            const { data } = await supabase
                .from("user_customization")
                .select("customization")
                .eq("user_id", user.id)
                .maybeSingle();
            if (mounted && data?.customization) {
                setCustomization((prev) => ({ ...prev, ...data.customization }));
            }
        };
        loadCustomization();
        return () => { mounted = false; };
    }, []);

    const boardTheme = customization.board_theme || "default";
    const pieceTheme = customization.piece_theme || "default";
    const moveEffect = customization.move_effect || "default";
    const avatarFrame = customization.avatar_frame || "default";
    const playerTitle = customization.title || "default";
    const game = useMemo(() => new Chess(position || undefined), [position]);

    const getPiece = (square) => {
        const piece = game.get(square);
        return piece
            ? `${piece.color}${piece.type.toUpperCase()}`
            : null;
    };

    useEffect(() => {
        if (!moveAnimations?.length || !boardRef.current) {
            setAnimations([]);
            setHiddenSquares([]);
            return;
        }

        const rect = boardRef.current.getBoundingClientRect();
        const boardStyle = window.getComputedStyle(boardRef.current);
        const borderLeft = Number.parseFloat(boardStyle.borderLeftWidth) || 0;
        const borderRight = Number.parseFloat(boardStyle.borderRightWidth) || 0;
        const borderTop = Number.parseFloat(boardStyle.borderTopWidth) || 0;
        const borderBottom = Number.parseFloat(boardStyle.borderBottomWidth) || 0;
        const boardSize = Math.max(0, rect.width - borderLeft - borderRight) / 8;

        // Absolute move overlays are positioned inside the board's padding box.
        // Exclude the decorative frame so animation endpoints align with squares.
        const squarePosition = square => ({
            x: (square.charCodeAt(0) - 97) * boardSize,
            y: (8 - Number(square[1])) * boardSize
        });

        const animationList = moveAnimations.map((move, index) => {
            const from = squarePosition(move.from);
            const to = squarePosition(move.to);

            return {
                ...move,
                id:
                    move.id ||
                    `${move.from}-${move.to}-${index}`,
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                size: boardSize,
                animate: false
            };
        });

        setHiddenSquares(
            moveAnimations.flatMap(move => [move.from, move.to])
        );

        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        let secondFrame = 0;
        setAnimations(reducedMotion
            ? animationList.map(animation => ({ ...animation, animate: true }))
            : animationList
        );

        const frame1 = reducedMotion ? 0 : requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                setAnimations(prev => prev.map(animation => ({ ...animation, animate: true })));
            });
        });

        const timer = window.setTimeout(() => {
            setAnimations([]);
            setHiddenSquares([]);
        }, reducedMotion ? 90 : 430);

        return () => {
            if (frame1) cancelAnimationFrame(frame1);
            if (secondFrame) cancelAnimationFrame(secondFrame);
            clearTimeout(timer);
        };
    }, [moveAnimations]);

    const [dragVisual, setDragVisual] = useState(null);

    const measureBoardBorder = () => {
        if (!boardRef.current) return null;
        const style = window.getComputedStyle(boardRef.current);
        boardBorderRef.current = {
            left: Number.parseFloat(style.borderLeftWidth) || 0,
            right: Number.parseFloat(style.borderRightWidth) || 0,
            top: Number.parseFloat(style.borderTopWidth) || 0,
            bottom: Number.parseFloat(style.borderBottomWidth) || 0
        };
        return boardBorderRef.current;
    };

    const getBoardPointer = (event) => {
        if (!boardRef.current) return null;
        const rect = boardRef.current.getBoundingClientRect();
        // Border geometry stays constant throughout a pointer gesture.
        // Read computed style once at drag start instead of on every pointermove.
        const border = boardBorderRef.current || measureBoardBorder() || {
            left: 0, right: 0, top: 0, bottom: 0
        };
        const width = Math.max(0, rect.width - border.left - border.right);
        const height = Math.max(0, rect.height - border.top - border.bottom);
        const size = width / 8;
        const x = event.clientX - rect.left - border.left;
        const y = event.clientY - rect.top - border.top;
        return {
            x,
            y,
            size,
            inside: x >= 0 && y >= 0 && x <= width && y <= height
        };
    };

    const getSquareFromPointer = (event) => {
        const pointer = getBoardPointer(event);
        if (!pointer || !pointer.inside) return null;

        const col = Math.max(0, Math.min(7, Math.floor(pointer.x / pointer.size)));
        const row = Math.max(0, Math.min(7, Math.floor(pointer.y / pointer.size)));

        return files[col] + (8 - row);
    };

    const updateDragVisual = (event) => {
        if (!pointerFromRef.current || !boardRef.current) return;

        const pointer = getBoardPointer(event);
        if (!pointer) return;

        setDragVisual((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                x: pointer.x - pointer.size / 2,
                y: pointer.y - pointer.size / 2,
                size: pointer.size
            };
        });
    };

    // Drag listeners are installed once per gesture, not once per pointer frame.
    // The dragged piece state can update at display refresh rate without repeatedly
    // tearing down and re-registering global listeners.
    const isDragging = Boolean(dragVisual);
    useEffect(() => {
        if (!isDragging || !pointerFromRef.current) return;

        const handlePointerMove = event => updateDragVisual(event);
        const handlePointerUp = event => finishPointerDrag(event);
        const handlePointerCancel = event => cancelPointerDrag(event);

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
        };
    }, [isDragging]);

    const startPointerDrag = (event, square) => {
        const p = game.get(square);

        // Any occupied square can be picked up, including the opponent's pieces
        // and pieces touched while the AI is thinking. Only the player's legal
        // turn is allowed to submit an actual move when the gesture ends.
        if (!canStartPieceDrag(p, { gameOver, promotionOpen: Boolean(promotionData) })) return;

        pointerFromRef.current = square;
        pointerCanCommitRef.current = canCommitPieceDrag(p, { turn, isThinking, gameOver });
        suppressClickRef.current = false;
        measureBoardBorder();
        setFocusedSquare(square);

        if (pointerCanCommitRef.current) {
            selectSquare(square);
        } else {
            clearSelection();
        }

        const pointer = getBoardPointer(event);
        if (!pointer) {
            pointerFromRef.current = null;
            pointerCanCommitRef.current = false;
            return;
        }

        try {
            event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {}

        setDragVisual({
            piece: `${p.color}${p.type.toUpperCase()}`,
            x: pointer.x - pointer.size / 2,
            y: pointer.y - pointer.size / 2,
            size: pointer.size
        });
    };

    const finishPointerDrag = (event) => {
        const from = pointerFromRef.current;
        if (!from) return;

        const to = getSquareFromPointer(event);
        const canCommitMove = pointerCanCommitRef.current;

        try {
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        } catch {}

        pointerFromRef.current = null;
        pointerCanCommitRef.current = false;
        setDragVisual(null);

        if (to && from !== to) {
            suppressClickRef.current = true;
            if (canCommitMove) dragMove(from, to);
        } else if (to === from) {
            suppressClickRef.current = false;
        }
    };

    const cancelPointerDrag = (event) => {
        pointerFromRef.current = null;
        pointerCanCommitRef.current = false;
        setDragVisual(null);
        try {
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        } catch {}
    };

    const squares = [];
    const currentKingSquare = inCheck ? checkSquare : null;

    const handleBoardKeyDown = event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            if (history.length > 0 && !isThinking && !gameOver) undoMove();
            return;
        }

        const col = files.indexOf(focusedSquare[0]);
        const row = 8 - Number(focusedSquare[1]);
        const offsets = {
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0]
        };

        if (offsets[event.key]) {
            event.preventDefault();
            const [dx, dy] = offsets[event.key];
            const nextCol = col + dx;
            const nextRow = row + dy;
            if (nextCol >= 0 && nextCol < 8 && nextRow >= 0 && nextRow < 8) {
                setFocusedSquare(files[nextCol] + (8 - nextRow));
            }
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            clickSquare(focusedSquare);
        } else if (event.key === "Escape") {
            event.preventDefault();
            clearSelection();
        }
    };

    useEffect(() => {
        if (!promotionData) return undefined;
        const frame = window.requestAnimationFrame(() => promotionFirstRef.current?.focus());
        const onKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                cancelPromotion();
                return;
            }
            if (event.key !== "Tab") return;
            const controls = Array.from(
                promotionFirstRef.current?.closest(".promotionMenu")
                    ?.querySelectorAll("button:not(:disabled)") || []
            );
            if (!controls.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener("keydown", onKeyDown);
            if (boardRef.current?.isConnected) {
                boardRef.current.focus({ preventScroll: true });
            }
        };
    }, [promotionData, cancelPromotion]);

    for (let row = 8; row >= 1; row -= 1) {
        for (let col = 0; col < 8; col += 1) {
            const square = files[col] + row;
            const light = (row + col) % 2 === 0;
            const piece = getPiece(square);
            const isCheck = inCheck && currentKingSquare === square;

            squares.push(
                <Square
                    key={square}
                    id={"chess-square-" + square}
                    color={light ? "light" : "dark"}
                    coordinate={square}
                    ariaSelected={selected === square}
                    ariaLabel={`${square}, ${piece ? (piece[0] === "w" ? "백" : "흑") + " " + pieceNames[piece[1].toLowerCase()] : "빈 칸"}${selected === square ? ", 선택됨" : ""}${moves.includes(square) ? ", 이동 가능" : ""}${isCheck && currentKingSquare === square ? ", 체크" : ""}`}
                    onClick={() => {
                        if (suppressClickRef.current) {
                            suppressClickRef.current = false;
                            return;
                        }
                        setFocusedSquare(square);
                        clickSquare(square);
                        boardRef.current?.focus({ preventScroll: true });
                    }}
                    onPointerDown={(event) => startPointerDrag(event, square)}
                    onPointerLeave={() => {}}
                    onDragStart={(event) => event.preventDefault()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                        const from =
                            event.dataTransfer.getData("from");

                        if (from) {
                            dragMove(from, square);
                        }
                    }}
                    highlight={moves.includes(square)}
                    selected={selected === square}
                    lastMove={
                        !!lastMove &&
                        (
                            lastMove.from === square ||
                            lastMove.to === square
                        )
                    }
                    check={isCheck}
                >
                    <Piece
                        theme={pieceTheme}
                        piece={
                            hiddenSquares.includes(square) ||
                            dragVisual?.piece && pointerFromRef.current === square
                                ? null
                                : piece
                        }
                        draggable={false}
                    />
                </Square>
            );
        }
    }

    const sortedCaptured = (pieces = []) =>
        [...pieces].sort(
            (a, b) =>
                (order[a[1]] ?? 9) -
                (order[b[1]] ?? 9)
        );

    const whiteMaterial = Number(materialScore?.white || 0);
    const blackMaterial = Number(materialScore?.black || 0);

    const whiteAdvantage =
        whiteMaterial > blackMaterial
            ? whiteMaterial - blackMaterial
            : 0;

    const blackAdvantage =
        blackMaterial > whiteMaterial
            ? blackMaterial - whiteMaterial
            : 0;

    const evaluation =
        Number.isFinite(Number(currentEvaluation))
            ? Number(currentEvaluation)
            : 0;

    return (
        <div className="boardWrapper">
            <div className="playerStack">
                <div className="playerCard opponentCard">
                    {profile.image ? <img className="playerAvatar" src={profile.image} alt="" /> : <div className="playerAvatar fallbackAvatar">♟</div>}
                    <div className="playerIdentity">
                        <div className="playerName">{profile.name || currentBot}</div>
                        <div className="playerMeta">BOT · Lv.{profile.level ?? 1} · {botData[currentBot]?.rating ?? 0} 레이팅</div>
                    </div>
                    <div className="playerClock" role="status" aria-live="polite">{opponentStatus}</div>
                </div>
                <SpeechBubble key={chess.dialogKey} text={dialog} hide={!dialog} />
                <div className={`playerCard selfCard avatar-frame-${avatarFrame}`}>
                    {playerProfile.image ? <img className="playerAvatar" src={playerProfile.image} alt="" /> : <div className="playerAvatar fallbackAvatar">♙</div>}
                    <div className="playerIdentity">
                        <div className="playerName">{playerProfile.name || "나"}</div>
                        {playerTitle !== "default" && <div className="equippedTitle">{playerTitle === "title_master" ? "Rockey Master" : "Tactician"}</div>}
                        <div className="playerMeta playerRatingMeta">
                            <span>PLAYER ·</span>
                            <span className="ratingDisplay">
                                <RatingChange rating={rating} change={ratingChange} visible={showRatingChange} />
                            </span>
                            <span className="ratingSuffix">레이팅</span>
                        </div>
                    </div>
                    <div className="playerClock" role="status" aria-live="polite">{playerStatus}</div>
                </div>
            </div>

            <div className="evaluationBarRow">
                <div className="evaluationLabel">평가</div>
                <div className="evaluationValue" aria-label={lastAnalysis ? `평가 ${evaluation.toFixed(2)}` : "아직 평가된 수가 없습니다."}>
                    {lastAnalysis ? <>{evaluation > 0 ? "+" : ""}{evaluation.toFixed(2)}</> : "—"}
                </div>

                {lastAnalysis?.side === "player" && (
                    <div
                        className={`moveQuality quality-${lastAnalysis.quality}`}
                    >
                        {QUALITY_LABELS[lastAnalysis.quality] ||
                            lastAnalysis.quality}
                        <span>
                            {lastAnalysis.san}
                        </span>
                    </div>
                )}
            </div>

            <div className="boardUtilityRow">
                <span id="board-keyboard-help">드래그 또는 두 번 선택 · 방향키 이동 · Enter 선택 · Esc 취소 · Ctrl+Z 되돌리기</span>
                <button type="button" className="boardUtilityButton" onClick={() => downloadPGN(gameSummary)} disabled={!history.length}>
                    <span aria-hidden="true">↓</span> PGN 저장
                </button>
            </div>

            <div className="boardArea">
                <div className="capturedRow">
                    <div className="capturedBox">
                        {sortedCaptured(capturedWhite).map(
                            (piece, index) => (
                                <img
                                    key={`${piece}-${index}`}
                                    src={`${import.meta.env.BASE_URL}pieces/${piece}.png`}
                                    className={`capturedPiece piece-theme-${pieceTheme}`}
                                    alt=""
                                />
                            )
                        )}
                    </div>

                    {whiteAdvantage > 0 && (
                        <div className="materialScore">
                            +{whiteAdvantage}
                        </div>
                    )}
                </div>

                <div
                    className={`board board-theme-${boardTheme} move-effect-${moveEffect}`}
                    ref={boardRef}
                    role="grid"
                    aria-label={`체스판. ${turn === "w" ? "내 차례" : "AI 차례"}. 방향키로 칸을 이동하고 Enter로 선택할 수 있습니다.`}
                    aria-activedescendant={"chess-square-" + focusedSquare}
                    aria-disabled={gameOver}
                    aria-describedby="board-keyboard-help"
                    tabIndex={0}
                    onKeyDown={handleBoardKeyDown}
                    onPointerMove={updateDragVisual}
                    onPointerUp={finishPointerDrag}
                    onPointerCancel={cancelPointerDrag}
                >
                    {squares}

                    {dragVisual && (
                        <div
                            className="draggingPiece"
                            style={{
                                width: dragVisual.size,
                                height: dragVisual.size,
                                transform: `translate(${dragVisual.x}px, ${dragVisual.y}px)`
                            }}
                            aria-hidden="true"
                        >
                            <img
                                src={`${import.meta.env.BASE_URL}pieces/${dragVisual.piece}.png`}
                                className={`movingPieceImg piece-theme-${pieceTheme}`}
                                alt=""
                            />
                        </div>
                    )}

                    {animations.map((animation) => (
                        <div
                            key={animation.id}
                            className="movingPiece"
                            aria-hidden="true"
                            style={{
                                width: animation.size,
                                height: animation.size,
                                transform: `translate(${
                                    animation.animate
                                        ? animation.toX
                                        : animation.fromX
                                }px, ${
                                    animation.animate
                                        ? animation.toY
                                        : animation.fromY
                                }px)`
                            }}
                        >
                            <img
                                src={`${import.meta.env.BASE_URL}pieces/${animation.piece}.png`}
                                className={`movingPieceImg piece-theme-${pieceTheme}`}
                                alt=""
                            />
                        </div>
                    ))}

                    {moveEffect !== "default" && (
                        <div
                            key={`${moveEffect}-${lastMove?.from || ""}-${lastMove?.to || ""}`}
                            className={`moveEffectOverlay effect-${moveEffect}`}
                            aria-hidden="true"
                        >
                            {moveEffect === "effect_spark" ? "✦" : "➜"}
                        </div>
                    )}
                </div>

                <div className="capturedRow">
                    <div className="capturedBox">
                        {sortedCaptured(capturedBlack).map(
                            (piece, index) => (
                                <img
                                    key={`${piece}-${index}`}
                                    src={`${import.meta.env.BASE_URL}pieces/${piece}.png`}
                                    className={`capturedPiece piece-theme-${pieceTheme}`}
                                    alt=""
                                />
                            )
                        )}
                    </div>

                    {blackAdvantage > 0 && (
                        <div className="materialScore">
                            +{blackAdvantage}
                        </div>
                    )}
                </div>

            {gameOver && (
                <>
                    <div className="game-over-backdrop" aria-hidden="true" />
                    <div className="game-over">
                        <section
                            className="popup"
                            ref={gameOverRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="chess-result-title"
                            aria-describedby="chess-result-detail"
                        >
                            <div className="resultEyebrow">ROCKEY CHESS · MATCH RESULT</div>
                            <h1 id="chess-result-title">
                                {result === "1/2-1/2" ? "무승부" : winner === "White" ? "승리" : "패배"}
                            </h1>
                            <h2 id="chess-result-detail">
                                {result === "1/2-1/2"
                                    ? "양쪽 모두 승패를 가리지 못했습니다."
                                    : winner === "White"
                                        ? "멋진 대국이었어요!"
                                        : "다음 대국에서 다시 도전해 보세요."}
                            </h2>

                            <div className="finalAccuracy">
                                <span>나의 정확도</span>
                                <strong>{Number(accuracy).toFixed(1)}%</strong>
                            </div>

                            <button
                                className="primaryAction"
                                onClick={() => openAnalysis()}
                                disabled={analysisBusy}
                            >
                                {analysisBusy ? "분석 준비 중…" : "📊 게임 분석하기"}
                            </button>
                            <button
                                className="secondaryAction"
                                onClick={() => downloadPGN(gameSummary)}
                                disabled={!gameSummary?.pgn}
                            >
                                기보 PGN 저장
                            </button>
                            <button className="secondaryAction" onClick={resetGame}>
                                다시 플레이
                            </button>
                        </section>
                    </div>
                </>
            )}
            </div>

            {promotionData && (
                <div
                    className="promotionBackdrop"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) cancelPromotion();
                    }}
                >
                    <section className="promotionMenu" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
                        <div className="promotionHeading">
                            <span id="promotion-title">승격할 기물을 선택하세요</span>
                            <small>{promotionData.to?.toUpperCase()}</small>
                        </div>
                        <div className="promotionChoices">
                            {[
                                ["Q", "퀸"],
                                ["R", "룩"],
                                ["B", "비숍"],
                                ["N", "나이트"]
                            ].map(([piece, label], index) => (
                                <button
                                    key={piece}
                                    ref={index === 0 ? promotionFirstRef : null}
                                    type="button"
                                    onClick={() => choosePromotion(piece.toLowerCase())}
                                    aria-label={`${label}으로 승격`}
                                    title={`${label}으로 승격`}
                                >
                                    <img src={`${import.meta.env.BASE_URL}pieces/w${piece}.png`} alt="" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        <button type="button" className="promotionCancel" onClick={cancelPromotion}>취소</button>
                    </section>
                </div>
            )}


        </div>
    );
}
