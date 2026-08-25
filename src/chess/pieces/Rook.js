import Piece from "./Piece";

export default class Rook extends Piece {
    constructor(color) {
        super(color);
    }

    getType() {
        return "rook";
    }

    canMove(fromRow, fromCol, toRow, toCol, board) {
        const sameRow = fromRow === toRow;
        const sameCol = fromCol === toCol;

        // 직선 이동이 아니면 불가
        if (sameRow === sameCol) {
            return false;
        }

        const rowDirection =
            toRow === fromRow
                ? 0
                : toRow > fromRow
                    ? 1
                    : -1;

        const colDirection =
            toCol === fromCol
                ? 0
                : toCol > fromCol
                    ? 1
                    : -1;

        let row = fromRow + rowDirection;
        let col = fromCol + colDirection;

        // 이동 경로 확인
        while (row !== toRow || col !== toCol) {
            if (board[row][col] !== null) {
                return false;
            }

            row += rowDirection;
            col += colDirection;
        }

        const target = board[toRow][toCol];

        return (
            target === null ||
            target.color !== this.color
        );
    }
}