import Piece from "./Piece";

export default class Bishop extends Piece {
    constructor(color) {
        super(color);
    }

    getType() {
        return "bishop";
    }

    canMove(fromRow, fromCol, toRow, toCol, board) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        // 대각선이 아니면 이동 불가
        if (rowDiff !== colDiff || rowDiff === 0) {
            return false;
        }

        const rowDirection =
            toRow > fromRow ? 1 : -1;

        const colDirection =
            toCol > fromCol ? 1 : -1;

        let row = fromRow + rowDirection;
        let col = fromCol + colDirection;

        // 이동 경로 확인
        while (row !== toRow && col !== toCol) {
            if (board[row][col] !== null) {
                return false;
            }

            row += rowDirection;
            col += colDirection;
        }

        // 도착 칸에 같은 색 기물이 있으면 불가
        const target = board[toRow][toCol];

        return (
            target === null ||
            target.color !== this.color
        );
    }
}