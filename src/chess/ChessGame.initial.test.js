import { describe, test, expect } from "vitest";
import ChessGame from "./ChessGame";

describe("ChessGame - 초기 게임 생성", () => {

    test("초기 게임 상태가 정상적으로 생성되어야 한다", () => {
        const game = new ChessGame();

        expect(game).toBeDefined();
        expect(game.gameState).toBeDefined();

        expect(game.board).toBeDefined();
        expect(game.board.length).toBe(8);

        expect(game.turn).toBe("w");
    });

});