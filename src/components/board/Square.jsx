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
    check
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

            {highlight && (
                <div className="highlight" />
            )}
        </div>
    );
}

export default Square;
