const PIECE_TONES = {
  p: { hz: 188, body: 0.82, label: "pawn" },
  n: { hz: 246, body: 1.02, label: "knight" },
  b: { hz: 286, body: 0.92, label: "bishop" },
  r: { hz: 142, body: 1.18, label: "rook" },
  q: { hz: 334, body: 0.86, label: "queen" },
  k: { hz: 126, body: 1.28, label: "king" },
};

let sharedContext;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContextClass();
  }
  if (sharedContext.state === "suspended") {
    sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

function addWoodImpact(context, start, frequency, strength = 1, warmth = 1) {
  const tone = context.createOscillator();
  const toneGain = context.createGain();
  const overtone = context.createOscillator();
  const overtoneGain = context.createGain();

  tone.type = "sine";
  tone.frequency.setValueAtTime(frequency, start);
  tone.frequency.exponentialRampToValueAtTime(Math.max(58, frequency * 0.58), start + 0.14);
  toneGain.gain.setValueAtTime(0.0001, start);
  toneGain.gain.exponentialRampToValueAtTime(0.21 * strength, start + 0.006);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17 * warmth);

  overtone.type = "triangle";
  overtone.frequency.setValueAtTime(frequency * 2.72, start);
  overtone.frequency.exponentialRampToValueAtTime(frequency * 1.35, start + 0.055);
  overtoneGain.gain.setValueAtTime(0.0001, start);
  overtoneGain.gain.exponentialRampToValueAtTime(0.045 * strength, start + 0.004);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);

  tone.connect(toneGain);
  toneGain.connect(context.destination);
  overtone.connect(overtoneGain);
  overtoneGain.connect(context.destination);
  tone.start(start);
  overtone.start(start);
  tone.stop(start + 0.19);
  overtone.stop(start + 0.09);

  const length = Math.max(1, Math.floor(context.sampleRate * 0.045));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const envelope = Math.pow(1 - i / length, 3.2);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1550 * warmth, start);
  filter.Q.value = 0.72;
  noiseGain.gain.setValueAtTime(0.0001, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.12 * strength, start + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.052);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(start);
  noise.stop(start + 0.055);
}

/**
 * Short, tactile board sounds. The six pieces use different resonances so a
 * pawn, rook, queen, and king do not all sound like the same generic click.
 */
export function playChessAudio(kind = "move", piece = "p", theme = "default") {
  const context = getAudioContext();
  if (!context) return false;

  try {
    const now = context.currentTime + 0.008;
    const selected = PIECE_TONES[String(piece || "p").toLowerCase()] || PIECE_TONES.p;
    const classicPack = theme === "sound_classic";
    const warmth = classicPack ? 1.18 : 1;
    const volume = classicPack ? 1.12 : 0.94;

    if (kind === "select") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(820, now);
      oscillator.frequency.exponentialRampToValueAtTime(510, now + 0.035);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055 * volume, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
      return true;
    }

    if (kind === "check") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.075);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075 * volume, now + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.14);
      return true;
    }

    const base = selected.hz * (classicPack ? 0.94 : 1);
    if (kind === "capture") {
      addWoodImpact(context, now, base * 0.82, 1.08 * volume, warmth);
      addWoodImpact(context, now + 0.052, base * 1.34, 0.52 * volume, warmth * 0.84);
      return true;
    }
    if (kind === "castle") {
      addWoodImpact(context, now, PIECE_TONES.k.hz, 1.03 * volume, warmth);
      addWoodImpact(context, now + 0.11, PIECE_TONES.r.hz * 1.3, 0.84 * volume, warmth);
      return true;
    }
    if (kind === "promotion") {
      addWoodImpact(context, now, base * 1.2, 0.92 * volume, warmth);
      addWoodImpact(context, now + 0.085, PIECE_TONES.q.hz * 1.25, 0.62 * volume, warmth);
      return true;
    }

    addWoodImpact(context, now, base, selected.body * volume, warmth);
    return true;
  } catch (error) {
    console.warn("Chess audio could not be played:", error);
    return false;
  }
}

export function previewChessPieceSound(piece, theme = "sound_classic") {
  return playChessAudio("move", piece, theme);
}
