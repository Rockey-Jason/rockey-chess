export default class MoveExecutor {
    constructor(gameState, moveValidator) {
        this.gameState = gameState;
        this.moveValidator = moveValidator;
    }

    // =========================
    // 실제 이동 실행
    // =========================

    executeMove(from, to) {
        // 1. 이동 가능 여부 검증
        const isValid = this.moveValidator.isValidMove(
            from,
            to
        );

        if (!isValid) {
            return {
                success: false,
                move: null
            };
        }

        // 2. 출발 기물 가져오기
        const piece = this.gameState.getPiece(
            from.row,
            from.col
        );

        // 안전장치
        if (!piece) {
            return {
                success: false,
                move: null
            };
        }

        // 3. 도착 칸의 기물
        const capturedPiece =
            this.gameState.getPiece(
                to.row,
                to.col
            );

        // 현재 턴 저장
        const turn = this.gameState.turn;

        // =========================
        // 4. 기물 이동
        // =========================

        this.gameState.setPiece(
            to.row,
            to.col,
            piece
        );

        // =========================
        // 5. 원래 칸 비우기
        // =========================

        this.gameState.setPiece(
            from.row,
            from.col,
            null
        );

        // =========================
        // 6. 잡힌 기물 처리
        // =========================

        if (capturedPiece) {
            this.gameState.capturePiece(
                capturedPiece
            );
        }

        // =========================
        // 7. 이동 기록 생성
        // =========================

        const move = {
            from: {
                row: from.row,
                col: from.col
            },

            to: {
                row: to.row,
                col: to.col
            },

            piece,

            capturedPiece,

            turn
        };

        // =========================
        // 8. 이동 기록 저장
        // =========================

        this.gameState.recordMove(move);

        // =========================
        // 9. 턴 전환
        // =========================

        this.gameState.switchTurn();

        // =========================
        // 10. 성공 반환
        // =========================

        return {
            success: true,
            move
        };
    }
}