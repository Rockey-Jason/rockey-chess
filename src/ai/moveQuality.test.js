import { describe, expect, it } from "vitest";
import { classifyMove, secondBestLoss } from "./moveQuality";

const openPosition = { moves: () => Array.from({ length: 20 }, (_, i) => "move-" + i) };
const quietPosition = { isAttacked: () => false };

describe("chess move quality classification", () => {
  it("recognizes a unique best move as Great", () => {
    const move = { piece: "n", color: "w", to: "d5", san: "Nd5" };
    expect(classifyMove(4, true, move, openPosition, quietPosition, { secondCpl: 104 }))
      .toBe("great");
  });

  it("keeps a forcing sacrifice as Brilliant when alternatives are much worse", () => {
    const move = { piece: "n", captured: "p", color: "w", to: "f7", san: "Nxf7+" };
    const attackedPosition = { isAttacked: () => true };
    expect(classifyMove(2, true, move, openPosition, attackedPosition, { secondCpl: 180 }))
      .toBe("brilliant");
  });

  it("does not award Great without a measured second candidate", () => {
    const move = { piece: "n", color: "w", to: "d5", san: "Nd5" };
    expect(classifyMove(4, true, move, openPosition, quietPosition, { secondCpl: null }))
      .toBe("best");
  });

  it("does not label a book move as Great", () => {
    const move = { piece: "n", color: "w", to: "d5", san: "Nd5" };
    expect(classifyMove(4, true, move, openPosition, quietPosition, { book: true, secondCpl: 120 }))
      .toBe("book");
  });

  it("never labels a delivered checkmate as a blunder", () => {
    const matingMove = { piece: "q", color: "w", to: "h7", san: "Qh7#" };
    const checkmatedPosition = { isCheckmate: () => true };
    expect(classifyMove(100000, false, matingMove, openPosition, checkmatedPosition, {}))
      .toBe("best");
  });

  it("recognizes a mating SAN even if the terminal position flag is unavailable", () => {
    const matingMove = { piece: "q", color: "w", to: "h7", san: "Qh7#" };
    expect(classifyMove(100000, false, matingMove, openPosition, quietPosition, {}))
      .toBe("best");
  });

  it("recognizes large evaluation losses as blunders", () => {
    const move = { piece: "q", color: "w", to: "a4", san: "Qa4" };
    expect(classifyMove(260, false, move, openPosition, quietPosition, {}))
      .toBe("blunder");
  });
});

describe("MultiPV score comparison", () => {
  it("measures the gap from the best candidate in the mover's perspective", () => {
    const result = {
      sideToMove: "w",
      candidates: [{ score: 42, move: "e2e4" }, { score: -38, move: "d2d4" }]
    };
    expect(secondBestLoss(result, "w", 42)).toBe(80);
  });

  it("returns null when the engine did not provide a second candidate", () => {
    expect(secondBestLoss({ sideToMove: "w", candidates: [{ score: 20 }] }, "w", 20)).toBeNull();
  });
});
