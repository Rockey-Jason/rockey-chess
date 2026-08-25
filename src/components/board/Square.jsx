import "./Square.css";

function Square({

    color,

    children,

    onClick,

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

            onDragOver={onDragOver}

            onDrop={onDrop}

        >

            {children}

            {highlight &&

                <div className="highlight"/>

            }

        </div>

    );

}

export default Square;