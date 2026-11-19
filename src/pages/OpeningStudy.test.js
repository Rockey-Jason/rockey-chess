import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { OPENINGS } from "./OpeningStudy.jsx";

const toUci = move => `${move.from}${move.to}${move.promotion || ""}`;

describe("Dori Chess opening lessons", () => {
  it("has unique opening ids and matching move/explanation counts", () => {
    expect(new Set(OPENINGS.map(opening => opening.id)).size).toBe(OPENINGS.length);
    for (const opening of OPENINGS) {
      expect(opening.moves.length).toBe(opening.lesson.length);
    }
  });

  for (const opening of OPENINGS) {
    it(`${opening.name} contains only legal moves`, () => {
      const game = new Chess();
      for (const [index, uci] of opening.moves.entries()) {
        const candidate = game.moves({ verbose: true }).find(move => toUci(move) === uci);
        expect(candidate, `${opening.name}: illegal move at ply ${index + 1}: ${uci}`).toBeDefined();
        expect(game.move({
          from: candidate.from,
          to: candidate.to,
          ...(candidate.promotion ? { promotion: candidate.promotion } : {}),
        })).toBeDefined();
      }
    });
  }
});
