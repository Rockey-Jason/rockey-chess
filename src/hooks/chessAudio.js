const TONES = { p: 188, n: 246, b: 286, r: 142, q: 334, k: 126 };
let contextRef;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!contextRef || contextRef.state === "closed") contextRef = new AudioContextClass();
  if (contextRef.state === "suspended") contextRef.resume().catch(() => {});
  return contextRef;
}

function woodTap(context, at, hz, strength, warmth) {
  const body = context.createOscillator();
  const bodyGain = context.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(hz, at);
  body.frequency.exponentialRampToValueAtTime(Math.max(55, hz * 0.56), at + 0.13);
  bodyGain.gain.setValueAtTime(0.0001, at);
  bodyGain.gain.exponentialRampToValueAtTime(0.2 * strength, at + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16 * warmth);
  body.connect(bodyGain);
  bodyGain.connect(context.destination);
  body.start(at);
  body.stop(at + 0.18);

  const length = Math.floor(context.sampleRate * 0.04);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.1);
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 1500 * warmth;
  noiseGain.gain.setValueAtTime(0.0001, at);
  noiseGain.gain.exponentialRampToValueAtTime(0.12 * strength, at + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(at);
  noise.stop(at + 0.052);
}

export function playChessAudio(kind = "move", piece = "p", theme = "default") {
  const context = getContext();
  if (!context) return false;

  try {
    const now = context.currentTime + 0.008;
    const hz = TONES[String(piece || "p").toLowerCase()] || TONES.p;
    const classic = theme === "sound_classic";
    const warmth = classic ? 1.2 : 1;
    const volume = classic ? 1.1 : 0.92;

    if (kind === "select") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(820, now);
      oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.035);
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
      gain.gain.exponentialRampToValueAtTime(0.07 * volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.14);
      return true;
    }

    if (kind === "capture") {
      woodTap(context, now, hz * 0.82, 1.08 * volume, warmth);
      woodTap(context, now + 0.05, hz * 1.34, 0.5 * volume, warmth * 0.85);
      return true;
    }
    if (kind === "castle") {
      woodTap(context, now, TONES.k, 1.02 * volume, warmth);
      woodTap(context, now + 0.1, TONES.r * 1.3, 0.82 * volume, warmth);
      return true;
    }
    if (kind === "promotion") {
      woodTap(context, now, hz * 1.2, 0.92 * volume, warmth);
      woodTap(context, now + 0.08, TONES.q * 1.25, 0.62 * volume, warmth);
      return true;
    }
    woodTap(context, now, hz, (kind === "move" ? 0.9 : 1) * volume, warmth);
    return true;
  } catch (error) {
    console.warn("Chess sound error:", error);
    return false;
  }
}
