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


describe("selected move board overlay", () => {
  const moves = [
    { uci: "e2e4", ply: 1, side: "player", quality: "great" },
    { uci: "e7e5", ply: 2, side: "bot", quality: "good" },
    { uci: "g1f3", ply: 3, side: "player", quality: "best" },
    { uci: "b8c6", ply: 4, side: "bot", quality: "brilliant" },
  ];

  it("shows only the currently selected move, not earlier or later routes", () => {
    const routes = buildBoardRouteMap(moves, 2);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      index: 2,
      from: "g1",
      to: "f3",
      fromX: 650,
      fromY: 750,
      toX: 550,
      toY: 550,
      quality: "best",
    });
  });

  it("shows the selected move even when it belongs to the opponent", () => {
    const routes = buildBoardRouteMap(moves, 1);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ index: 1, from: "e7", to: "e5", quality: "good" });
  });

  it("places the quality badge near the upper-right of the destination square", () => {
    const [route] = buildBoardRouteMap(moves, 2);
    expect(route.toLeft).toBeCloseTo(71.6);
    expect(route.toTop).toBeCloseTo(65.9);
  });

  it("renders no route when no move is selected or the coordinates are invalid", () => {
    expect(buildBoardRouteMap(moves)).toEqual([]);
    expect(buildBoardRouteMap([{ uci: "e2", side: "player" }], 0)).toEqual([]);
    expect(buildBoardRouteMap([{ uci: "z9a1", side: "bot" }], 0)).toEqual([]);
  });
});
