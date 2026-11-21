import { describe, expect, it } from "vitest";
import { buildBoardRouteMap, filterAnalysisMoves, formatEvaluation } from "./AnalysisModal";

const sample = [
  { quality: "best", san: "Nf3", ply: 1 },
  { quality: "inaccuracy", san: "h3", ply: 2 },
  { quality: "mistake", san: "Qh4", ply: 3 },
  { quality: "brilliant", san: "Bxh7+", ply: 4 },
  { quality: "great", san: "Nd5", ply: 5 },
  { quality: "blunder", san: "Qe7", ply: 6 },
];

describe("analysis studio helpers", () => {
  it("preserves the order of every move in the all-moves filter", () => {
    expect(filterAnalysisMoves(sample).map(({ move }) => move.san))
      .toEqual(["Nf3", "h3", "Qh4", "Bxh7+", "Nd5", "Qe7"]);
  });

  it("filters critical inaccuracies, mistakes and blunders without changing source indices", () => {
    expect(filterAnalysisMoves(sample, "critical").map(({ index }) => index))
      .toEqual([1, 2, 5]);
  });

  it("filters strong moves separately", () => {
    expect(filterAnalysisMoves(sample, "good").map(({ move }) => move.san))
      .toEqual(["Nf3", "Bxh7+", "Nd5"]);
  });

  it("formats centipawn evaluations with a consistent sign and precision", () => {
    expect(formatEvaluation({ evaluation: 1.236 })).toBe("+1.24");
    expect(formatEvaluation({ evaluation: -0.5 })).toBe("-0.50");
    expect(formatEvaluation({ evaluation: 0 })).toBe("0.00");
    expect(formatEvaluation({ evaluation: "not-a-number" })).toBe("—");
  });

  it("formats mate scores from White's point of view", () => {
    expect(formatEvaluation({ mate: { moves: 3, winner: "white" } })).toBe("+M3");
    expect(formatEvaluation({ mate: { moves: -2, winner: "black" } })).toBe("−M2");
  });
});


describe("analysis board move-route overlay", () => {
  it("maps each UCI move to board coordinates and preserves the source move index", () => {
    const routes = buildBoardRouteMap([
      { uci: "e2e4", ply: 1, side: "player", quality: "great" },
      { uci: "e7e5", ply: 2, side: "bot", quality: "good" },
      { uci: "g1f3", ply: 3, side: "player", quality: "best" },
    ]);

    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({
      index: 0, from: "e2", to: "e4", fromX: 450, fromY: 650, toX: 450, toY: 450,
    });
    expect(routes[1]).toMatchObject({
      index: 2, from: "g1", to: "f3", fromX: 650, fromY: 750, toX: 550, toY: 550,
    });
  });

  it("keeps multiple arrivals on the same square separately identifiable", () => {
    const routes = buildBoardRouteMap([
      { uci: "e2e4", ply: 1, side: "player", quality: "best" },
      { uci: "d2e4", ply: 2, side: "player", quality: "mistake" },
    ]);
    expect(routes.map(route => route.destinationStack)).toEqual([0, 1]);
  });

  it("ignores malformed or incomplete move coordinates", () => {
    expect(buildBoardRouteMap([
      { uci: "e2", side: "player" },
      { uci: "z9a1", side: "player" },
      { san: "Nf3", side: "player" },
      { uci: "e7e5", side: "bot" },
    ])).toEqual([]);
  });
});


describe("player-only board move routes", () => {
  it("never shows the opponent's moves, while retaining original ply indices", () => {
    const routes = buildBoardRouteMap([
      { uci: "e2e4", ply: 1, side: "player", quality: "good" },
      { uci: "e7e5", ply: 2, side: "bot", quality: "blunder" },
      { uci: "g1f3", ply: 3, side: "player", quality: "great" },
      { uci: "b8c6", ply: 4, side: "bot", quality: "brilliant" },
    ]);

    expect(routes.map(route => route.index)).toEqual([0, 2]);
    expect(routes.map(route => route.from + route.to)).toEqual(["e2e4", "g1f3"]);
    expect(routes.every(route => route.move.side === "player")).toBe(true);
  });
});
