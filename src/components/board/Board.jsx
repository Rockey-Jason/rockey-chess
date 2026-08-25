import "./Board.css";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

import Square from "./Square";
import Piece from "../Piece";
import SpeechBubble from "../SpeechBubble";
import botData from "../../data/botData";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

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
    const [hiddenSquares, setHiddenSquares] = useState([]);
    const [animations, setAnimations] = useState([]);

    const {
        position = "",
        selected = null,
        moves = [],
        clickSquare = () => {},
        selectSquare = () => {},
        lastMove = null,
        inCheck = false,
        gameOver = false,
        currentBot = "talc",
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
        currentEvaluation = 0,
        lastAnalysis = null
    } = chess;

    const profile = botData[currentBot] || botData.talc || {};
    const game = new Chess(position || undefined);

    const getPiece = (square) => {
        const piece = game.get(square);
        return piece
            ? `${piece.color}${piece.type.toUpperCase()}`
            : null;
    };

    const kingSquare = () => {
        const board = game.board();

        for (let row = 0; row < 8; row += 1) {
            for (let col = 0; col < 8; col += 1) {
                const piece = board[row][col];

                if (
                    piece &&
                    piece.type === "k" &&
                    piece.color === game.turn()
                ) {
                    return `${files[col]}${8 - row}`;
                }
            }
        }

        return null;
    };

    useEffect(() => {
        if (!moveAnimations?.length || !boardRef.current) {
            setAnimations([]);
            setHiddenSquares([]);
            return;
        }

        const boardSize =
            boardRef.current.getBoundingClientRect().width / 8;

        const squarePosition = (square) => ({
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
            moveAnimations.flatMap((move) => [move.from, move.to])
        );
        setAnimations(animationList);

        const frame1 = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setAnimations((prev) =>
                    prev.map((animation) => ({
                        ...animation,
                        animate: true
                    }))
                );
            });
        });

        const timer = setTimeout(() => {
            setAnimations([]);
            setHiddenSquares([]);
        }, 350);

        return () => {
            cancelAnimationFrame(frame1);
            clearTimeout(timer);
        };
    }, [moveAnimations]);

    const squares = [];

    for (let row = 8; row >= 1; row -= 1) {
        for (let col = 0; col < 8; col += 1) {
            const square = files[col] + row;
            const light = (row + col) % 2 === 0;
            const piece = getPiece(square);
            const isCheck =
                inCheck && kingSquare() === square;

            squares.push(
                <Square
                    key={square}
                    color={light ? "light" : "dark"}
                    onClick={() => clickSquare(square)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                        event.preventDefault();
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
                        piece={
                            hiddenSquares.includes(square)
                                ? null
                                : piece
                        }
                        draggable={!!piece}
                        onDragStart={(event) => {
                            event.dataTransfer.setData(
                                "from",
                                square
                            );
                            event.dataTransfer.effectAllowed =
                                "move";
                            selectSquare(square);
                        }}
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
            <div className="boardHeader">
                <div className="opponentBox">
                    <img
                        className="opponentImage"
                        src={profile.image}
                        alt={profile.name || currentBot}
                    />

                    <div className="opponentInfo">
                        <div className="opponentName">
                            {profile.name || currentBot}
                        </div>

                        <div className="opponentLevel">
                            Lv.{profile.level ?? 1}
                        </div>
                    </div>
                </div>

                <SpeechBubble
                    key={chess.dialogKey}
                    text={dialog}
                    hide={!dialog}
                />
            </div>

            <div className="evaluationBarRow">
                <div className="evaluationLabel">평가</div>
                <div className="evaluationValue">
                    {evaluation > 0 ? "+" : ""}
                    {evaluation.toFixed(2)}
                </div>

                {lastAnalysis && (
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

            <div className="boardArea">
                <div className="capturedRow">
                    <div className="capturedBox">
                        {sortedCaptured(capturedWhite).map(
                            (piece, index) => (
                                <img
                                    key={`${piece}-${index}`}
                                    src={`${import.meta.env.BASE_URL}pieces/${piece}.png`}
                                    className="capturedPiece"
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

                <div className="board" ref={boardRef}>
                    {squares}

                    {animations.map((animation) => (
                        <div
                            key={animation.id}
                            className="movingPiece"
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
                                className="movingPieceImg"
                                alt=""
                            />
                        </div>
                    ))}
                </div>

                <div className="capturedRow">
                    <div className="capturedBox">
                        {sortedCaptured(capturedBlack).map(
                            (piece, index) => (
                                <img
                                    key={`${piece}-${index}`}
                                    src={`${import.meta.env.BASE_URL}pieces/${piece}.png`}
                                    className="capturedPiece"
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
            </div>

            {promotionData && (
                <div className="promotionMenu">
                    {["Q", "R", "B", "N"].map((piece) => (
                        <img
                            key={piece}
                            src={`${import.meta.env.BASE_URL}pieces/w${piece}.png`}
                            onClick={() =>
                                choosePromotion(piece.toLowerCase())
                            }
                            alt={piece}
                        />
                    ))}
                </div>
            )}

            {gameOver && (
                <div className="game-over">
                    <div className="popup">
                        <div className="resultEyebrow">
                            ROCKEY CHESS
                        </div>

                        <h1>
                            {result === "1/2-1/2"
                                ? "DRAW"
                                : "GAME OVER"}
                        </h1>

                        <h2>{winner}</h2>

                        <div className="finalAccuracy">
                            <span>Accuracy</span>
                            <strong>{accuracy}%</strong>
                        </div>

                        <button
                            className="primaryAction"
                            onClick={() =>
                                downloadPGN(gameSummary)
                            }
                        >
                            기보 저장
                        </button>

                        <button
                            className="secondaryAction"
                            onClick={resetGame}
                        >
                            다시 플레이
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
