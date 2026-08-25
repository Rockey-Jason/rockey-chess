export default class MoveValidator {
    constructor(gameState) {
        this.gameState = gameState;
    }

    // =========================
    // 이동 가능 여부
    // =========================

    isValidMove(from, to) {
        if (
            !this.isValidPosition(from) ||
            !this.isValidPosition(to)
        ) {
            return false;
        }

        const fromRow = from.row;
        const fromCol = from.col;

        const toRow = to.row;
        const toCol = to.col;

        // 출발 위치의 기물
        const piece = this.gameState.getPiece(
            fromRow,
            fromCol
        );

        // 기물이 없으면 이동 불가능
        if (!piece) {
            return false;
        }

        // 현재 턴의 기물이 아니면 이동 불가능
        if (
            piece.color !== this.gameState.turn
        ) {
            return false;
        }

        // 도착 위치의 기물
        const target = this.gameState.getPiece(
            toRow,
            toCol
        );

        // 같은 색 기물은 잡을 수 없음
        if (
            target &&
            target.color === piece.color
        ) {
            return false;
        }

        // 실제 기물의 이동 규칙 확인
        return piece.canMove(
            fromRow,
            fromCol,
            toRow,
            toCol,
            this.gameState.board
        );
    }

    // =========================
    // 위치 검증
    // =========================

    isValidPosition(position) {
        return (
            position &&
            Number.isInteger(position.row) &&
            Number.isInteger(position.col) &&
            position.row >= 0 &&
            position.row < 8 &&
            position.col >= 0 &&
            position.col < 8
        );
    }
}