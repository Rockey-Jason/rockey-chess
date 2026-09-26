import GameState from "./GameState";
import MoveValidator from "./MoveValidator";
import MoveExecutor from "./MoveExecutor";

export default class ChessGame {
    constructor() {
        // ========================================
        // 게임 상태
        // ========================================

        this.gameState = new GameState();

        // ========================================
        // 이동 검증기
        // ========================================

        this.moveValidator = new MoveValidator(
            this.gameState
        );

        // ========================================
        // 이동 실행기
        // ========================================

        this.moveExecutor = new MoveExecutor(
            this.gameState,
            this.moveValidator
        );

        // ========================================
        // 초기 게임 상태 검증
        // ========================================

        this.gameState.validateInitialGameState();
    }

    // ========================================
    // 보드
    // ========================================

    get board() {
        return this.gameState.board;
    }

    // ========================================
    // 턴
    // ========================================

    get turn() {
        return this.gameState.getTurn();
    }

    getTurn() {
        return this.gameState.getTurn();
    }

    switchTurn() {
        return this.gameState.switchTurn();
    }

    // ========================================
    // 기물 가져오기
    // ========================================

    getPiece(row, col) {
        return this.gameState.getPiece(
            row,
            col
        );
    }

    // ========================================
    // 현재 턴의 기물인지 확인
    // ========================================

    isCurrentTurnPiece(row, col) {
        const piece = this.getPiece(
            row,
            col
        );

        if (!piece) {
            return false;
        }

        return (
            piece.color === this.gameState.getTurn()
        );
    }

    // ========================================
    // 기물 자체가 이동 가능한 턴인지 확인
    // ========================================

    canPieceMove(piece) {
        if (!piece) {
            return false;
        }

        return (
            piece.color === this.gameState.getTurn()
        );
    }

    // ========================================
    // 실제 이동 가능 여부
    // ========================================

    canMove(from, to) {
        return this.moveValidator.isValidMove(
            from,
            to
        );
    }

    isValidMove(from, to) {
        return this.moveValidator.isValidMove(
            from,
            to
        );
    }

    // ========================================
    // 실제 이동 실행
    // ========================================

    move(from, to) {
        return this.moveExecutor.executeMove(
            from,
            to
        );
    }

    executeMove(from, to) {
        return this.moveExecutor.executeMove(
            from,
            to
        );
    }

    // ========================================
    // 이동 기록
    // ========================================

    getMoveHistory() {
        return this.gameState.moveHistory;
    }

    // ========================================
    // 잡힌 기물
    // ========================================

    getCapturedPieces() {
        return this.gameState.capturedPieces;
    }
}