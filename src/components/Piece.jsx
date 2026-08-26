import "./Piece.css";

export default function Piece({
  piece,
  draggable,
  onDragStart,
  theme = "default",
  className = "",
}) {
  if (!piece) return null;

  return (
    <img
      className={`piece piece-theme-${theme} ${className}`}
      src={`${import.meta.env.BASE_URL}pieces/${piece}.png`}
      alt={piece}
      draggable={draggable}
      onDragStart={onDragStart}
    />
  );
}
