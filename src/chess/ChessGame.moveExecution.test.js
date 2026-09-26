import { describe, test, expect } from "vitest";
import ChessGame from "./ChessGame";

describe("ChessGame - 실제 이동 실행", () => {

    test("정상적인 기물 이동이 실행되어야 한다", () => {
        const game = new ChessGame();

        // 백 폰 e2
        const piece = game.getPiece(6, 4);

        expect(piece).toBeDefined();
        expect(piece.color).toBe("w");

        const result = game.move(
            { row: 6, col: 4 },
            { row: 4, col: 4 }
        );

        expect(result.success).toBe(true);

        // 원래 칸은 비어야 한다
        expect(
            game.getPiece(6, 4)
        ).toBeNull();

        // 도착 칸에 같은 기물이 있어야 한다
        expect(
            game.getPiece(4, 4)
        ).toBe(piece);
    });


    test("정상적인 이동 후 턴이 변경되어야 한다", () => {
        const game = new ChessGame();

        expect(game.getTurn()).toBe("w");

        const result = game.move(
            { row: 6, col: 4 },
            { row: 4, col: 4 }
        );

        expect(result.success).toBe(true);

        expect(game.getTurn()).toBe("b");
    });


    test("잘못된 이동은 보드를 변경하지 않아야 한다", () => {
        const game = new ChessGame();

        const piece = game.getPiece(6, 4);

        const result = game.move(
            { row: 6, col: 4 },
            { row: 3, col: 4 }
        );

        expect(result.success).toBe(false);

        // 원래 기물이 그대로 있어야 함
        expect(
            game.getPiece(6, 4)
        ).toBe(piece);

        // 도착 칸은 비어 있어야 함
        expect(
            game.getPiece(3, 4)
        ).toBeNull();

        // 턴도 그대로
        expect(game.getTurn()).toBe("w");
    });


    test("상대 기물을 잡으면 도착 칸의 기물이 교체되어야 한다", () => {
        const game = new ChessGame();

        /*
            테스트를 위해 보드를 직접 구성한다.

            백 룩
            a1 → a7

            a7에 흑 폰을 놓는다.
        */

        const whiteRook =
            game.getPiece(7, 0);

        const blackPawn =
            game.getPiece(1, 0);

        // 중간 기물 제거
        game.gameState.setPiece(
            6,
            0,
            null
        );

        game.gameState.setPiece(
            5,
            0,
            null
        );

        game.gameState.setPiece(
            4,
            0,
            null
        );

        game.gameState.setPiece(
            3,
            0,
            null
        );

        game.gameState.setPiece(
            2,
            0,
            null
        );

        // a7에 흑 폰 배치
        game.gameState.setPiece(
            1,
            0,
            blackPawn
        );

        const result = game.move(
            { row: 7, col: 0 },
            { row: 1, col: 0 }
        );

        expect(result.success).toBe(true);

        expect(
            game.getPiece(1, 0)
        ).toBe(whiteRook);

        expect(
            game.getPiece(7, 0)
        ).toBeNull();

        expect(
            result.move.capturedPiece
        ).toBe(blackPawn);

        expect(
            game.getCapturedPieces()
        ).toContain(blackPawn);
    });


    test("정상적인 이동은 moveHistory에 기록되어야 한다", () => {
        const game = new ChessGame();

        expect(
            game.getMoveHistory().length
        ).toBe(0);

        const result = game.move(
            { row: 6, col: 4 },
            { row: 4, col: 4 }
        );

        expect(result.success).toBe(true);

        expect(
            game.getMoveHistory().length
        ).toBe(1);

        const move =
            game.getMoveHistory()[0];

        expect(move.from).toEqual({
            row: 6,
            col: 4
        });

        expect(move.to).toEqual({
            row: 4,
            col: 4
        });

        expect(move.turn).toBe("w");
    });


    test("백과 흑이 연속으로 이동할 수 있어야 한다", () => {
        const game = new ChessGame();

        // 백
        const whiteResult = game.move(
            { row: 6, col: 4 },
            { row: 4, col: 4 }
        );

        expect(whiteResult.success).toBe(true);
        expect(game.getTurn()).toBe("b");

        // 흑
        const blackResult = game.move(
            { row: 1, col: 4 },
            { row: 3, col: 4 }
        );

        expect(blackResult.success).toBe(true);
        expect(game.getTurn()).toBe("w");

        expect(
            game.getMoveHistory().length
        ).toBe(2);
    });


    test("현재 턴이 아닌 기물의 이동은 실행되지 않아야 한다", () => {
        const game = new ChessGame();

        // 현재는 w
        expect(game.getTurn()).toBe("w");

        // 흑 폰 선택
        const result = game.move(
            { row: 1, col: 0 },
            { row: 3, col: 0 }
        );

        expect(result.success).toBe(false);

        expect(game.getTurn()).toBe("w");

        expect(
            game.getPiece(1, 0)
        ).not.toBeNull();
    });
});