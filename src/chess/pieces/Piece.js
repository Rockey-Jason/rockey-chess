export default class Piece {
    constructor(color) {
        if (color !== "w" && color !== "b") {
            throw new Error(`잘못된 색상 값: ${color}`);
        }

        this.color = color;
    }

    getType() {
        return "piece";
    }
}