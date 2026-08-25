import { describe, test, expect } from "vitest";
import ChessGame from "./ChessGame";

describe("ChessGame - 실제 기물 이동 검증 연결", () => {

    test("초기 상태에서 백색 폰의 한 칸 이동을 허용해야 한다", () => {
        const game = new ChessGame();

        expect(
            game.canPieceMove(
                { row: 6, col: 0 },
                { row: 5, col: 0 }
            )
        ).toBe(true);
    });

    test("초기 상태에서 백색 폰의 두 칸 이동을 허용해야 한다", () => {
        const game = new ChessGame();

        expect(
            game.canPieceMove(
                { row: 6, col: 0 },
                { row: 4, col: 0 }
            )
        ).toBe(true);
    });

    test("초기 상태에서 흑색 폰의 이동은 거부해야 한다", () => {
        const game = new ChessGame();

        expect(
            game.canPieceMove(
                { row: 1, col: 0 },
                { row: 2, col: 0 }
            )
        ).toBe(false);
    });

    test("같은 색 기물을 잡는 이동은 거부해야 한다", () => {
        const game = new ChessGame();

        expect(
            game.canPieceMove(
                { row: 7, col: 0 },
                { row: 6, col: 0 }
            )
        ).toBe(false);
    });
});