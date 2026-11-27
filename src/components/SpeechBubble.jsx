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
        if (typingRef.current) {
            clearInterval(typingRef.current);
            typingRef.current = null;
        }
        if (hideRef.current) {
            clearTimeout(hideRef.current);
            hideRef.current = null;
        }

        if (!text || hide) {
            setTyping(false);
            setVisible(false);
            hideRef.current = window.setTimeout(() => {
                setDisplayText("");
                hideRef.current = null;
            }, 280);

            return () => {
                if (hideRef.current) clearTimeout(hideRef.current);
                hideRef.current = null;
            };
        }

        setVisible(true);
        const chars = Array.from(text);
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (reducedMotion) {
            setDisplayText(text);
            setTyping(false);
            return undefined;
        }

        setDisplayText("");
        setTyping(true);
        let index = 0;
        typingRef.current = window.setInterval(() => {
            index += 1;
            setDisplayText(chars.slice(0, index).join(""));

            if (index >= chars.length) {
                if (typingRef.current) window.clearInterval(typingRef.current);
                typingRef.current = null;
                setTyping(false);
            }
        }, 34);

        return () => {
            if (typingRef.current) window.clearInterval(typingRef.current);
            if (hideRef.current) window.clearTimeout(hideRef.current);
            typingRef.current = null;
            hideRef.current = null;
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
        <>
            <div
                className={`speechBubble ${visible ? "show" : "hide"} ${
                    typing ? "typing" : ""
                }`}
                style={{ width: `${measuredWidth}px` }}
                aria-hidden="true"
            >
                <span className="speechText">
                    {displayText}
                    {typing && <span className="speechCursor">▌</span>}
                </span>
                <span className="speechTail" />
            </div>
            <span className="speechSrOnly" role="status" aria-live="polite" aria-atomic="true">
                {visible ? text : ""}
            </span>
        </>
    );
}
