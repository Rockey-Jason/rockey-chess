import { describe, test, expect } from "vitest";
import ChessGame from "./ChessGame";

describe("ChessGame - 기물 선택 및 이동 가능 여부", () => {

    test("기물 위치에서 기물을 가져올 수 있어야 한다", () => {
        const game = new ChessGame();

        const piece = game.getPiece(7, 0);

        expect(piece).toBeDefined();
        expect(piece.color).toBe("w");
        expect(piece.getType()).toBe("rook");
    });


    test("빈 칸을 선택하면 null을 반환해야 한다", () => {
        const game = new ChessGame();

        const piece = game.getPiece(4, 4);

        expect(piece).toBeNull();
    });


    test("잘못된 위치를 선택하면 null을 반환해야 한다", () => {
        const game = new ChessGame();

        expect(game.getPiece(-1, 0)).toBeNull();
        expect(game.getPiece(8, 0)).toBeNull();
        expect(game.getPiece(0, -1)).toBeNull();
        expect(game.getPiece(0, 8)).toBeNull();
    });


    test("현재 턴의 기물을 선택하면 true를 반환해야 한다", () => {
        const game = new ChessGame();

        expect(
            game.isCurrentTurnPiece(7, 0)
        ).toBe(true);
    });


    test("현재 턴이 아닌 기물을 선택하면 false를 반환해야 한다", () => {
        const game = new ChessGame();

        expect(
            game.isCurrentTurnPiece(0, 0)
        ).toBe(false);
    });


    test("빈 칸은 현재 턴의 기물이 아니어야 한다", () => {
        const game = new ChessGame();

        expect(
            game.isCurrentTurnPiece(4, 4)
        ).toBe(false);
    });


    test("턴이 바뀌면 현재 턴의 기물도 바뀌어야 한다", () => {
        const game = new ChessGame();

        expect(
            game.isCurrentTurnPiece(7, 0)
        ).toBe(true);

        game.switchTurn();

        expect(
            game.isCurrentTurnPiece(7, 0)
        ).toBe(false);

        expect(
            game.isCurrentTurnPiece(0, 0)
        ).toBe(true);
    });


    test("MoveValidator가 ChessGame에 연결되어 있어야 한다", () => {
        const game = new ChessGame();

        expect(game.moveValidator).toBeDefined();
    });


    test("현재 턴이 아닌 기물은 이동 검증에서 false여야 한다", () => {
        const game = new ChessGame();

        const result = game.canPieceMove(
            { row: 0, col: 0 },
            { row: 2, col: 0 }
        );

        expect(result).toBe(false);
    });

});