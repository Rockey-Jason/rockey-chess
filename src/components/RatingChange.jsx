import { useEffect, useRef, useState } from "react";
import "./RatingChange.css";

export default function RatingChange({ rating = 0, change = 0, visible = false }) {
  const target = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  const delta = Number.isFinite(Number(change)) ? Number(change) : 0;
  const start = target - delta;
  const [value, setValue] = useState(target);
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const previousTarget = useRef(target);

  useEffect(() => {
    if (!visible || delta === 0) {
      setValue(target);
      setLeaving(false);
      setActive(false);
      return;
    }
    const from = previousTarget.current === target ? start : previousTarget.current;
    const duration = Math.min(1500, Math.max(700, 650 + Math.abs(delta) * 0.08));
    const started = performance.now();
    setActive(true);
    setLeaving(false);
    let frame;
    const animate = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
      else {
        setValue(target);
        window.setTimeout(() => setLeaving(true), 1450);
        window.setTimeout(() => setActive(false), 1850);
      }
    };
    frame = requestAnimationFrame(animate);
    previousTarget.current = target;
    return () => cancelAnimationFrame(frame);
  }, [target, delta, visible, start]);

  if (!active && !visible) return null;
  const positive = delta > 0;
  const negative = delta < 0;

  return (
    <span className={`ratingLive ${positive ? "ratingUp" : negative ? "ratingDown" : "ratingFlat"} ${leaving ? "ratingLeaving" : ""}`}>
      <span className="ratingNumber">{value.toLocaleString()}</span>
      {delta !== 0 && (
        <span className="ratingDelta" aria-label={`레이팅 ${delta > 0 ? "상승" : "하락"} ${Math.abs(delta)}`}>
          <span className="ratingDeltaArrow">{positive ? "↑" : "↓"}</span>
          {positive ? "+" : "−"}{Math.abs(delta).toLocaleString()}
        </span>
      )}
      {delta !== 0 && <span className="ratingAura" aria-hidden="true" />}
    </span>
  );
}
