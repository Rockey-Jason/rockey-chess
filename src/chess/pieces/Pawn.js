import Piece from "./Piece";

export default class Pawn extends Piece {
    constructor(color) {
        super(color);
    }

    getType() {
        return "pawn";
    }

    canMove(
        fromRow,
        fromCol,
        toRow,
        toCol,
        board
    ) {
        // ------------------------------------
        // 이동 방향
        //
        // w: 위쪽으로 이동 → row 감소
        // b: 아래쪽으로 이동 → row 증가
        // ------------------------------------

        const direction =
            this.color === "w" ? -1 : 1;

        // ------------------------------------
        // 같은 열인지
        // ------------------------------------

        const sameColumn =
            fromCol === toCol;

        // ------------------------------------
        // 세로 이동 거리
        // ------------------------------------

        const rowDifference =
            toRow - fromRow;

        // ====================================
        // 1칸 전진
        // ====================================

        if (
            sameColumn &&
            rowDifference === direction &&
            board[toRow][toCol] === null
        ) {
            return true;
        }

        // ====================================
        // 2칸 전진
        // ====================================

        const startRow =
            this.color === "w" ? 6 : 1;

        if (
            fromRow === startRow &&
            sameColumn &&
            rowDifference === direction * 2 &&
            board[fromRow + direction][fromCol] === null &&
            board[toRow][toCol] === null
        ) {
            return true;
        }

        // ====================================
        // 대각선 공격
        // ====================================

        const columnDifference =
            toCol - fromCol;

        if (
            Math.abs(columnDifference) === 1 &&
            rowDifference === direction
        ) {
            const target =
                board[toRow][toCol];

            if (
                target &&
                target.color !== this.color
            ) {
                return true;
            }
        }

        // ====================================
        // 그 외 이동 불가능
        // ====================================

        return false;
    }
}