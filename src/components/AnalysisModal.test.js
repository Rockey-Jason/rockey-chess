import { describe, expect, it } from "vitest";
import { filterAnalysisMoves, formatEvaluation } from "./AnalysisModal";

const sample = [
  { quality: "best", san: "Nf3", ply: 1 },
  { quality: "inaccuracy", san: "h3", ply: 2 },
  { quality: "mistake", san: "Qh4", ply: 3 },
  { quality: "brilliant", san: "Bxh7+", ply: 4 },
  { quality: "blunder", san: "Qe7", ply: 5 },
];

describe("analysis studio helpers", () => {
  it("preserves the order of every move in the all-moves filter", () => {
    expect(filterAnalysisMoves(sample).map(({ move }) => move.san))
      .toEqual(["Nf3", "h3", "Qh4", "Bxh7+", "Qe7"]);
  });

  it("filters critical inaccuracies, mistakes and blunders without changing source indices", () => {
    expect(filterAnalysisMoves(sample, "critical").map(({ index }) => index))
      .toEqual([1, 2, 4]);
  });

  it("filters strong moves separately", () => {
    expect(filterAnalysisMoves(sample, "good").map(({ move }) => move.san))
      .toEqual(["Nf3", "Bxh7+"]);
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
