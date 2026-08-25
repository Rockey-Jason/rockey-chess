import "./Piece.css";

function Piece({

    piece,

    draggable,

    onDragStart

}) {

    if (!piece) return null;

    return (

        <img

            className="piece"

            src={`${import.meta.env.BASE_URL}pieces/${piece}.png`}

            alt={piece}

            draggable={draggable}

            onDragStart={onDragStart}

        />

    );

}

export default Piece;