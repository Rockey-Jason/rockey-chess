const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function secondBestLoss(result, color, bestScore) {
  const second = result?.candidates?.[1];
  if (!second || !Number.isFinite(Number(bestScore))) return null;

  const rawScore = second.mate != null
    ? (Number(second.mate) > 0 ? 100000 : -100000)
    : Number(second.score);

  if (!Number.isFinite(rawScore)) return null;

  const perspective = result.sideToMove === color ? 1 : -1;
  const secondScore = rawScore * perspective;
  return Math.max(0, Number(bestScore) - secondScore);
}

/**
 * Classifies a move using the centipawn loss and the engine's MultiPV gap.
 * "great" is reserved for a strong, effectively unique best move rather than
 * being inferred from a check or capture alone.
 */
export function classifyMove(
  cpl,
  isBest,
  move,
  beforeGame,
  afterGame,
  meta = {}
) {
  const loss = Number.isFinite(Number(cpl)) ? Math.max(0, Number(cpl)) : 999999;
  // A completed mate is decisive regardless of score availability or opening tags.
  if (afterGame?.isCheckmate?.() || move?.san?.includes("#")) return "best";

  const movedValue = PIECE_VALUES[move?.piece] ?? 0;
  const capturedValue = PIECE_VALUES[move?.captured] ?? 0;
  const legalCount = beforeGame?.moves?.().length ?? 0;
  const forced = legalCount <= 1;
  const secondGap = meta.secondCpl != null && Number.isFinite(Number(meta.secondCpl))
    ? Number(meta.secondCpl)
    : null;

  let destinationAttacked = false;
  try {
    const opponentColor = move?.color === "w" ? "b" : "w";
    destinationAttacked = Boolean(afterGame?.isAttacked?.(move?.to, opponentColor));
  } catch {
    destinationAttacked = false;
  }

  const sacrifice =
    movedValue >= 3 &&
    destinationAttacked &&
    (!move?.captured || capturedValue < movedValue);

  const brilliant =
    Boolean(isBest) &&
    !forced &&
    sacrifice &&
    loss <= 15 &&
    secondGap !== null &&
    secondGap >= 150 &&
    !move?.san?.includes("#");

  if (meta.book) return "book";
  if (forced && isBest) return "forced";
  if (brilliant) return "brilliant";

  const great =
    Boolean(isBest) &&
    !forced &&
    loss <= 12 &&
    secondGap !== null &&
    secondGap >= 80;

  if (great) return "great";
  if (isBest && loss <= 20) return "best";
  if (loss <= 20) return "excellent";
  if (loss <= 45) return "good";
  if (loss <= 100) return "inaccuracy";
  if (loss <= 220) return "mistake";
  return "blunder";
}
