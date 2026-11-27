export function shouldHandleDragPointer(event, activePointerId = null) {
    if (!event) return false;
    if (activePointerId !== null) return event.pointerId === activePointerId;
    if (event.isPrimary === false) return false;
    return event.pointerType !== "mouse" || event.button === 0;
}

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
