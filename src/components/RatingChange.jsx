import { useEffect, useRef, useState } from "react";
import "./RatingChange.css";

export default function RatingChange({ rating = 0, change = 0, visible = false }) {
  const target = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  const delta = Number.isFinite(Number(change)) ? Number(change) : 0;
  const start = target - delta;
  const [value, setValue] = useState(target);
  const [phase, setPhase] = useState("idle");
  const previousTarget = useRef(target);

  useEffect(() => {
    if (!visible || delta === 0) {
      setValue(target);
      setPhase("idle");
      return undefined;
    }

    const from = previousTarget.current === target ? start : previousTarget.current;
    const timers = [];
    let frame = 0;

    setValue(from);
    setPhase("entering");

    timers.push(window.setTimeout(() => setPhase("merging"), 1900));

    timers.push(window.setTimeout(() => {
      setPhase("counting");
      const duration = Math.min(1900, Math.max(1100, 1100 + Math.abs(delta) * 0.08));
      const started = performance.now();

      const animate = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3.8);
        setValue(Math.round(from + (target - from) * eased));

        if (progress < 1) frame = requestAnimationFrame(animate);
        else {
          setValue(target);
          setPhase("settling");
        }
      };

      frame = requestAnimationFrame(animate);
    }, 2450));

    timers.push(window.setTimeout(() => setPhase("leaving"), 5000));
    timers.push(window.setTimeout(() => setPhase("idle"), 5550));

    previousTarget.current = target;

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
    };
  }, [target, delta, visible, start]);

  if (phase === "idle" && !visible) return null;

  const positive = delta > 0;
  const negative = delta < 0;
  const phaseClass = phase === "entering" ? "ratingEntering"
    : phase === "merging" ? "ratingMerging"
    : phase === "counting" ? "ratingCounting"
    : phase === "settling" ? "ratingSettling"
    : phase === "leaving" ? "ratingLeaving"
    : "";

  return (
    <span className={"ratingLive " + (positive ? "ratingUp" : negative ? "ratingDown" : "ratingFlat") + " " + phaseClass}>
      <span className="ratingNumber">{value.toLocaleString()}</span>

      {delta !== 0 && (
        <span className="ratingDelta" aria-label={"레이팅 " + (delta > 0 ? "상승" : "하락") + " " + Math.abs(delta)}>
          <span className="ratingDeltaArrow">{positive ? "↑" : "↓"}</span>
          {positive ? "+" : "−"}{Math.abs(delta).toLocaleString()}
        </span>
      )}

      {delta !== 0 && (
        <>
          <span className="ratingAura" aria-hidden="true" />
          <span className="ratingParticles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
        </>
      )}
    </span>
  );
}
