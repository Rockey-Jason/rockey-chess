import Piece from "./Piece";

export default class King extends Piece {
    constructor(color) {
        super(color);
    }

    getType() {
        return "king";
    }

    canMove(fromRow, fromCol, toRow, toCol, board) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        // 한 칸만 이동
        if (
            rowDiff > 1 ||
            colDiff > 1 ||
            (rowDiff === 0 && colDiff === 0)
        ) {
            return false;
        }

        const target = board[toRow][toCol];

        return (
            target === null ||
            target.color !== this.color
        );
    }

    isCastlingMove(
    fromRow,
    fromCol,
    toRow,
    toCol,
    gameState
) {
    if (fromRow !== toRow) {
        return false;
    }

    if (Math.abs(toCol - fromCol) !== 2) {
        return false;
    }

    if (gameState.hasPieceMoved(this)) {
        return false;
    }

    if (gameState.isKingInCheck(this.color)) {
        return false;
    }

    const direction = toCol > fromCol ? 1 : -1;

    const rookCol = direction === 1 ? 7 : 0;

    const rook = gameState.getPiece(
        fromRow,
        rookCol
    );

    if (!rook) {
        return false;
    }

    if (rook.getType() !== "rook") {
        return false;
    }

    if (rook.color !== this.color) {
        return false;
    }

    if (gameState.hasPieceMoved(rook)) {
        return false;
    }

    const start = Math.min(fromCol, rookCol);
    const end = Math.max(fromCol, rookCol);

    for (let col = start + 1; col < end; col++) {
        if (gameState.getPiece(fromRow, col)) {
            return false;
        }
    }

    return true;
}

}