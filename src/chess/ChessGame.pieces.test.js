import { describe, test, expect } from "vitest";

import Pawn from "./pieces/Pawn";
import Knight from "./pieces/Knight";
import Bishop from "./pieces/Bishop";
import Rook from "./pieces/Rook";
import Queen from "./pieces/Queen";
import King from "./pieces/King";

function emptyBoard() {
    return Array.from(
        { length: 8 },
        () => Array(8).fill(null)
    );
}

describe("표준 체스 기물 이동 규칙", () => {

    test("Knight는 L자로 이동할 수 있어야 한다", () => {
        const board = emptyBoard();
        const knight = new Knight("w");

        expect(
            knight.canMove(4, 4, 6, 5, board)
        ).toBe(true);

        expect(
            knight.canMove(4, 4, 6, 6, board)
        ).toBe(false);
    });

    test("Bishop은 대각선으로 이동할 수 있어야 한다", () => {
        const board = emptyBoard();
        const bishop = new Bishop("w");

        expect(
            bishop.canMove(4, 4, 6, 6, board)
        ).toBe(true);

        expect(
            bishop.canMove(4, 4, 6, 5, board)
        ).toBe(false);
    });

    test("Bishop은 경로에 기물이 있으면 이동할 수 없어야 한다", () => {
        const board = emptyBoard();
        const bishop = new Bishop("w");

        board[5][5] = new Pawn("b");

        expect(
            bishop.canMove(4, 4, 6, 6, board)
        ).toBe(false);
    });

    test("Rook은 직선으로 이동할 수 있어야 한다", () => {
        const board = emptyBoard();
        const rook = new Rook("w");

        expect(
            rook.canMove(4, 4, 4, 7, board)
        ).toBe(true);

        expect(
            rook.canMove(4, 4, 7, 4, board)
        ).toBe(true);
    });

    test("Rook은 대각선으로 이동할 수 없어야 한다", () => {
        const board = emptyBoard();
        const rook = new Rook("w");

        expect(
            rook.canMove(4, 4, 6, 6, board)
        ).toBe(false);
    });

    test("Queen은 직선과 대각선으로 이동할 수 있어야 한다", () => {
        const board = emptyBoard();
        const queen = new Queen("w");

        expect(
            queen.canMove(4, 4, 4, 7, board)
        ).toBe(true);

        expect(
            queen.canMove(4, 4, 7, 7, board)
        ).toBe(true);
    });

    test("Queen은 L자로 이동할 수 없어야 한다", () => {
        const board = emptyBoard();
        const queen = new Queen("w");

        expect(
            queen.canMove(4, 4, 6, 5, board)
        ).toBe(false);
    });

    test("King은 한 칸 이동할 수 있어야 한다", () => {
        const board = emptyBoard();
        const king = new King("w");

        expect(
            king.canMove(4, 4, 5, 5, board)
        ).toBe(true);
    });

    test("King은 두 칸 이동할 수 없어야 한다", () => {
        const board = emptyBoard();
        const king = new King("w");

        expect(
            king.canMove(4, 4, 6, 4, board)
        ).toBe(false);
    });

    test("같은 색 기물이 있는 칸은 이동할 수 없어야 한다", () => {
        const board = emptyBoard();
        const rook = new Rook("w");

        board[4][7] = new Pawn("w");

        expect(
            rook.canMove(4, 4, 4, 7, board)
        ).toBe(false);
    });

    test("상대 기물이 있는 칸은 이동할 수 있어야 한다", () => {
        const board = emptyBoard();
        const rook = new Rook("w");

        board[4][7] = new Pawn("b");

        expect(
            rook.canMove(4, 4, 4, 7, board)
        ).toBe(true);
    });
});