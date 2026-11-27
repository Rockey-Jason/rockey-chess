import { describe, expect, it } from "vitest";
import { canCommitPieceDrag, canStartPieceDrag, shouldHandleDragPointer } from "./dragRules";

describe("board piece dragging", () => {
    it("lets either color be picked up regardless of whose turn it is", () => {
        expect(canStartPieceDrag({ color: "w", type: "p" })).toBe(true);
        expect(canStartPieceDrag({ color: "b", type: "n" })).toBe(true);
    });

    it("allows a pickup while the AI is thinking", () => {
        expect(canStartPieceDrag({ color: "b", type: "q" })).toBe(true);
    });

    it("does not start a drag from an empty square or over a blocking dialog", () => {
        expect(canStartPieceDrag(null)).toBe(false);
        expect(canStartPieceDrag({ color: "w", type: "p" }, { gameOver: true })).toBe(false);
        expect(canStartPieceDrag({ color: "w", type: "p" }, { promotionOpen: true })).toBe(false);
    });

    it("only allows committing a player's own piece on the player's turn", () => {
        expect(canCommitPieceDrag({ color: "w", type: "p" })).toBe(true);
        expect(canCommitPieceDrag({ color: "b", type: "p" })).toBe(false);
        expect(canCommitPieceDrag({ color: "w", type: "p" }, { turn: "b" })).toBe(false);
    });

    it("never commits a move while the AI is thinking or the game is over", () => {
        const whitePawn = { color: "w", type: "p" };
        expect(canCommitPieceDrag(whitePawn, { isThinking: true })).toBe(false);
        expect(canCommitPieceDrag(whitePawn, { gameOver: true })).toBe(false);
    });
});

describe("mouse and touch pointer ownership", () => {
    it("accepts the primary mouse button and touch pointer", () => {
        expect(shouldHandleDragPointer({ pointerId: 1, pointerType: "mouse", button: 0 })).toBe(true);
        expect(shouldHandleDragPointer({ pointerId: 2, pointerType: "touch", button: 0 })).toBe(true);
    });

    it("ignores right-click and secondary touch pointers", () => {
        expect(shouldHandleDragPointer({ pointerId: 1, pointerType: "mouse", button: 2 })).toBe(false);
        expect(shouldHandleDragPointer({ pointerId: 2, pointerType: "touch", isPrimary: false })).toBe(false);
    });

    it("only updates or finishes the pointer that started the drag", () => {
        expect(shouldHandleDragPointer({ pointerId: 7 }, 7)).toBe(true);
        expect(shouldHandleDragPointer({ pointerId: 8 }, 7)).toBe(false);
    });
});
