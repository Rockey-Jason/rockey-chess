import Pawn from "./pieces/Pawn";
import Knight from "./pieces/Knight";
import Bishop from "./pieces/Bishop";
import Rook from "./pieces/Rook";
import Queen from "./pieces/Queen";
import King from "./pieces/King";

export default class GameState {
    constructor() {
        this.turn = "w";

        this.board = this.createInitialBoard();

        this.moveHistory = [];
        this.capturedPieces = [];

        this.validateInitialGameState();
    }

    // ========================================
    // 초기 체스판 생성
    // ========================================

    createInitialBoard() {
        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        // 흑 기물
        board[0] = [
            new Rook("b"),
            new Knight("b"),
            new Bishop("b"),
            new Queen("b"),
            new King("b"),
            new Bishop("b"),
            new Knight("b"),
            new Rook("b")
        ];

        board[1] = [
            new Pawn("b"),
            new Pawn("b"),
            new Pawn("b"),
            new Pawn("b"),
            new Pawn("b"),
            new Pawn("b"),
            new Pawn("b"),
            new Pawn("b")
        ];

        // 백 기물
        board[6] = [
            new Pawn("w"),
            new Pawn("w"),
            new Pawn("w"),
            new Pawn("w"),
            new Pawn("w"),
            new Pawn("w"),
            new Pawn("w"),
            new Pawn("w")
        ];

        board[7] = [
            new Rook("w"),
            new Knight("w"),
            new Bishop("w"),
            new Queen("w"),
            new King("w"),
            new Bishop("w"),
            new Knight("w"),
            new Rook("w")
        ];

        return board;
    }

    // ========================================
    // 턴
    // ========================================

    getTurn() {
        return this.turn;
    }

    switchTurn() {
        this.turn = this.turn === "w"
            ? "b"
            : "w";

        return this.turn;
    }

    // ========================================
    // 기물 가져오기
    // ========================================

    getPiece(row, col) {
        if (
            !Number.isInteger(row) ||
            !Number.isInteger(col) ||
            row < 0 ||
            row >= 8 ||
            col < 0 ||
            col >= 8
        ) {
            return null;
        }

        return this.board[row][col];
    }

    // ========================================
    // 기물 배치
    // ========================================

    setPiece(row, col, piece) {
        if (
            !Number.isInteger(row) ||
            !Number.isInteger(col) ||
            row < 0 ||
            row >= 8 ||
            col < 0 ||
            col >= 8
        ) {
            return false;
        }

        this.board[row][col] = piece;

        return true;
    }

    // ========================================
    // 현재 턴의 색인지
    // ========================================

    isCurrentTurnColor(color) {
        if (color !== "w" && color !== "b") {
            throw new Error(
                `잘못된 색상 값: ${color}`
            );
        }

        return this.turn === color;
    }

    // ========================================
    // 잡힌 기물 기록
    // ========================================

    capturePiece(piece) {
        if (piece) {
            this.capturedPieces.push(piece);
        }
    }

    // ========================================
    // 이동 기록
    // ========================================

    recordMove(move) {
        this.moveHistory.push(move);
    }

    // ========================================
    // 초기 게임 상태 검증
    // ========================================

    validateInitialGameState() {
        if (!Array.isArray(this.board)) {
            throw new Error(
                "초기 보드가 배열이 아닙니다."
            );
        }

        if (this.board.length !== 8) {
            throw new Error(
                "초기 보드는 8행이어야 합니다."
            );
        }

        for (const row of this.board) {
            if (!Array.isArray(row)) {
                throw new Error(
                    "보드의 각 행은 배열이어야 합니다."
                );
            }

            if (row.length !== 8) {
                throw new Error(
                    "보드의 각 행은 8칸이어야 합니다."
                );
            }
        }

        if (this.turn !== "w") {
            throw new Error(
                "새 게임의 첫 턴은 w여야 합니다."
            );
        }

        return true;
    }
}