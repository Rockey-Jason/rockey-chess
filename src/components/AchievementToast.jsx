import "./AchievementToast.css";

export default function AchievementToast({ achievement, onClose }) {
  if (!achievement) return null;

  const rarityClass = String(achievement.rarity || "Common").toLowerCase();

  return (
    <div className="achievement-toast-wrap" role="status" aria-live="polite">
      <div className={`achievement-toast achievement-rarity-${rarityClass}`}>
        <div className="achievement-toast-glow" />
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
        <button className="achievement-toast-close" onClick={onClose} aria-label="업적 알림 닫기">×</button>
      </div>
    </div>
  );
}
