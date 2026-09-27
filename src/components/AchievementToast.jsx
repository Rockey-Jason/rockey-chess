import { useCallback, useEffect, useRef, useState } from "react";
import "./AchievementToast.css";

const EXIT_DURATION = 760;

export default function AchievementToast({ achievement, onClose }) {
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef(null);

  const close = useCallback(() => {
    if (!achievement || isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    window.clearTimeout(closeTimerRef.current);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    closeTimerRef.current = window.setTimeout(() => onClose?.(), reducedMotion ? 0 : EXIT_DURATION);
  }, [achievement, onClose]);

  useEffect(() => {
    isClosingRef.current = false;
    setIsClosing(false);
    window.clearTimeout(closeTimerRef.current);
    if (!achievement) return undefined;
    const timer = window.setTimeout(close, 6500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(closeTimerRef.current);
    };
  }, [achievement, close]);

  if (!achievement) return null;
  const rarityClass = String(achievement.rarity || "Common").toLowerCase();

  return (
    <div className="achievement-toast-wrap" role="status" aria-live="polite">
      <div className={"achievement-toast achievement-rarity-" + rarityClass + (isClosing ? " achievement-toast-closing" : "")}>
        <div className="achievement-toast-glow" />
        <div className="achievement-toast-particles" aria-hidden="true" />
        <div className="achievement-toast-icon">
          <span>{achievement.icon || "🏆"}</span>
        </div>
        <div className="achievement-toast-copy">
          <div className="achievement-toast-kicker">ACHIEVEMENT UNLOCKED</div>
          <div className="achievement-toast-title">업적 달성!</div>
          <div className="achievement-toast-name">{achievement.name}</div>
          <div className="achievement-toast-description">{achievement.description}</div>
          <div className="achievement-toast-rewards">
            {Number(achievement.reward_doldolcoin || 0) > 0 && (
              <span>💰 +{Number(achievement.reward_doldolcoin).toLocaleString()} 돌돌코인</span>
            )}
            {Number(achievement.reward_exp || 0) > 0 && (
              <span>✨ +{Number(achievement.reward_exp).toLocaleString()} EXP</span>
            )}
            {achievement.title && <span>🏷️ {achievement.title}</span>}
          </div>
        </div>
        <button className="achievement-toast-close" onClick={close} aria-label="업적 알림 닫기" disabled={isClosing}>×</button>
      </div>
    </div>
  );
}