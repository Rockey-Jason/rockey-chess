import { useEffect, useRef, useState } from "react";
import "./SpeechBubble.css";

export default function SpeechBubble({
    text = "",
    hide = false,
    minWidth = 180,
    maxWidth = 360
}) {
    const [displayText, setDisplayText] = useState("");
    const [visible, setVisible] = useState(false);
    const [typing, setTyping] = useState(false);
    const typingRef = useRef(null);
    const hideRef = useRef(null);

    useEffect(() => {
        if (typingRef.current) clearInterval(typingRef.current);
        if (hideRef.current) clearTimeout(hideRef.current);

        if (!text || hide) {
            setTyping(false);
            setVisible(false);

            hideRef.current = setTimeout(() => {
                setDisplayText("");
            }, 360);

            return () => {};
        }

        setDisplayText("");
        setVisible(true);
        setTyping(true);

        let index = 0;
        const chars = Array.from(text);

        typingRef.current = setInterval(() => {
            index += 1;
            setDisplayText(chars.slice(0, index).join(""));

            if (index >= chars.length) {
                clearInterval(typingRef.current);
                typingRef.current = null;
                setTyping(false);
            }
        }, 38);

        return () => {
            if (typingRef.current) clearInterval(typingRef.current);
            if (hideRef.current) clearTimeout(hideRef.current);
        };
    }, [text, hide]);

    const measuredWidth = Math.min(
        maxWidth,
        Math.max(
            minWidth,
            Array.from(text || "").length * 12 + 48
        )
    );

    return (
        <div
            className={`speechBubble ${visible ? "show" : "hide"} ${
                typing ? "typing" : ""
            }`}
            style={{ width: `${measuredWidth}px` }}
            aria-hidden={!visible}
        >
            <span className="speechText">
                {displayText}
                {typing && <span className="speechCursor">▌</span>}
            </span>
            <span className="speechTail" />
        </div>
    );
}
