export function canStartPieceDrag(piece, { gameOver = false, promotionOpen = false } = {}) {
    return Boolean(piece) && !gameOver && !promotionOpen;
}

export function canCommitPieceDrag(
    piece,
    { turn = "w", playerColor = "w", isThinking = false, gameOver = false } = {}
) {
    return Boolean(
        piece &&
        !gameOver &&
        !isThinking &&
        piece.color === playerColor &&
        turn === playerColor
    );
}
