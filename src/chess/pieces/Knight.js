import Piece from "./Piece";

export default class Knight extends Piece {
    constructor(color) {
        super(color);
    }

    getType() {
        return "knight";
    }

    canMove(fromRow, fromCol, toRow, toCol, board) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        // 나이트의 L자 이동
        if (!(
            (rowDiff === 2 && colDiff === 1) ||
            (rowDiff === 1 && colDiff === 2)
        )) {
            return false;
        }

        const target = board[toRow][toCol];

        // 빈 칸 또는 상대 기물
        return (
            target === null ||
            target.color !== this.color
        );
    }
}