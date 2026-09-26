import { describe, test, expect } from "vitest";
import ChessGame from "./ChessGame";

describe("ChessGame - 현재 턴 확인", () => {

    test("새 게임은 백 차례로 시작해야 한다", () => {
        const game = new ChessGame();

        expect(game.getTurn()).toBe("w");
    });

    test("현재 턴은 GameState의 턴과 같아야 한다", () => {
        const game = new ChessGame();

        expect(game.getTurn()).toBe(game.gameState.getTurn());
    });

    test("백 차례에서 턴을 전환하면 흑 차례가 되어야 한다", () => {
        const game = new ChessGame();

        expect(game.getTurn()).toBe("w");

        game.switchTurn();

        expect(game.getTurn()).toBe("b");
    });

    test("흑 차례에서 턴을 전환하면 백 차례가 되어야 한다", () => {
        const game = new ChessGame();

        game.switchTurn();

        expect(game.getTurn()).toBe("b");

        game.switchTurn();

        expect(game.getTurn()).toBe("w");
    });

    test("현재 턴과 같은 색의 기물은 이동 가능한 기물로 판단해야 한다", () => {
        const game = new ChessGame();

        const whitePiece = game.gameState.board[7][0];

        expect(whitePiece.color).toBe("w");
        expect(game.getTurn()).toBe("w");

        expect(game.canPieceMove(whitePiece)).toBe(true);
    });

    test("현재 턴과 다른 색의 기물은 이동할 수 없는 기물로 판단해야 한다", () => {
        const game = new ChessGame();

        const blackPiece = game.gameState.board[0][0];

        expect(blackPiece.color).toBe("b");
        expect(game.getTurn()).toBe("w");

        expect(game.canPieceMove(blackPiece)).toBe(false);
    });

    test("턴이 바뀌면 이동 가능한 기물의 색상도 바뀌어야 한다", () => {
        const game = new ChessGame();

        const whitePiece = game.gameState.board[7][0];
        const blackPiece = game.gameState.board[0][0];

        expect(game.canPieceMove(whitePiece)).toBe(true);
        expect(game.canPieceMove(blackPiece)).toBe(false);

        game.switchTurn();

        expect(game.getTurn()).toBe("b");

        expect(game.canPieceMove(whitePiece)).toBe(false);
        expect(game.canPieceMove(blackPiece)).toBe(true);
    });

    test("기물이 없으면 이동할 수 없는 것으로 판단해야 한다", () => {
        const game = new ChessGame();

        expect(game.canPieceMove(null)).toBe(false);
    });
});