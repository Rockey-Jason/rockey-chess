import "./Square.css";

function Square({
    color,
    children,
    onClick,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onDragStart,
    onDragOver,
    onDrop,
    highlight,
    selected,
    lastMove,
    check,
    coordinate
}) {
    return (
        <div
            className={
                `square
                ${color}
                ${selected ? " selected" : ""}
                ${lastMove ? " lastMove" : ""}
                ${check ? " check" : ""}`
            }
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {children}

            {coordinate?.[0] === "a" && (
                <span className="coordinateRank" aria-hidden="true">{coordinate[1]}</span>
            )}
            {coordinate?.[1] === "1" && (
                <span className="coordinateFile" aria-hidden="true">{coordinate[0]}</span>
            )}

            {highlight && (
                <div className="highlight" />
            )}
        </div>
    );
}

export default Square;
