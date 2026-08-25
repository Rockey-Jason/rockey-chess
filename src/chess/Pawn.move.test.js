import { describe, test, expect } from "vitest";
import Pawn from "./pieces/Pawn";

describe("Pawn - 표준 체스 이동 규칙", () => {

    test("백색 폰은 처음 위치에서 한 칸 전진할 수 있어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        expect(
            pawn.canMove(6, 0, 5, 0, board)
        ).toBe(true);
    });

    test("백색 폰은 처음 위치에서 두 칸 전진할 수 있어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        expect(
            pawn.canMove(6, 0, 4, 0, board)
        ).toBe(true);
    });

    test("흑색 폰은 처음 위치에서 두 칸 전진할 수 있어야 한다", () => {
        const pawn = new Pawn("b");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        expect(
            pawn.canMove(1, 0, 3, 0, board)
        ).toBe(true);
    });

    test("폰은 뒤로 이동할 수 없어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        expect(
            pawn.canMove(6, 0, 7, 0, board)
        ).toBe(false);
    });

    test("앞에 기물이 있으면 폰은 전진할 수 없어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        board[5][0] = new Pawn("b");

        expect(
            pawn.canMove(6, 0, 5, 0, board)
        ).toBe(false);
    });

    test("대각선에 상대 기물이 있으면 공격할 수 있어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        board[5][1] = new Pawn("b");

        expect(
            pawn.canMove(6, 0, 5, 1, board)
        ).toBe(true);
    });

    test("대각선에 같은 색 기물이 있으면 이동할 수 없어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        board[5][1] = new Pawn("w");

        expect(
            pawn.canMove(6, 0, 5, 1, board)
        ).toBe(false);
    });

    test("두 칸 전진 시 중간 칸이 막혀 있으면 이동할 수 없어야 한다", () => {
        const pawn = new Pawn("w");

        const board = Array.from(
            { length: 8 },
            () => Array(8).fill(null)
        );

        board[5][0] = new Pawn("b");

        expect(
            pawn.canMove(6, 0, 4, 0, board)
        ).toBe(false);
    });
});