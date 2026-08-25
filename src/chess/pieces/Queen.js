import Piece from "./Piece";

export default class Queen extends Piece {
    constructor(color) {
        super(color);
    }

    getType() {
        return "queen";
    }

    canMove(fromRow, fromCol, toRow, toCol, board) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        const isDiagonal =
            rowDiff === colDiff &&
            rowDiff !== 0;

        const isStraight =
            (fromRow === toRow) !==
            (fromCol === toCol);

        if (!isDiagonal && !isStraight) {
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