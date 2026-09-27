/**
 * Web Audio API based notification chime synthesizer
 * Zero external audio file dependency, works offline & instantly on all modern browsers
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Pre-warm/unlock audio context on user interaction (clicks/taps)
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/**
 * Play a high-quality alert chime synthesized with Web Audio API
 */
export function playNotificationSound(type: "ticket_assigned" | "message" | "alert" | "success" = "ticket_assigned"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "ticket_assigned" || type === "alert") {
      // Distinctive 3-tone chime for new ticket dispatch (D5 -> A5 -> D6)
      const notes = [
        { freq: 587.33, start: 0.0, duration: 0.18, gain: 0.28 },
        { freq: 880.0, start: 0.14, duration: 0.22, gain: 0.35 },
        { freq: 1174.66, start: 0.30, duration: 0.45, gain: 0.40 },
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.start);

        // Gentle overtone for richer bell sound
        const oscOvertone = ctx.createOscillator();
        const gainOvertone = ctx.createGain();
        oscOvertone.type = "triangle";
        oscOvertone.frequency.setValueAtTime(note.freq * 2, now + note.start);

        gain.gain.setValueAtTime(0.001, now + note.start);
        gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

        gainOvertone.gain.setValueAtTime(0.001, now + note.start);
        gainOvertone.gain.exponentialRampToValueAtTime(note.gain * 0.25, now + note.start + 0.02);
        gainOvertone.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration * 0.7);

        osc.connect(gain);
        oscOvertone.connect(gainOvertone);
        gain.connect(ctx.destination);
        gainOvertone.connect(ctx.destination);

        osc.start(now + note.start);
        oscOvertone.start(now + note.start);
        osc.stop(now + note.start + note.duration + 0.05);
        oscOvertone.stop(now + note.start + note.duration + 0.05);
      });
    } else if (type === "message") {
      // Soft double-blip for chat messages
      const notes = [
        { freq: 783.99, start: 0.0, duration: 0.12, gain: 0.2 },
        { freq: 1046.5, start: 0.1, duration: 0.2, gain: 0.25 },
      ];
      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.start);

        gain.gain.setValueAtTime(0.001, now + note.start);
        gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.duration + 0.02);
      });
    } else {
      // Default single confirmation ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch (err) {
    console.warn("[Sound] Unable to synthesize notification audio:", err);
  }
}

/**
 * Trigger vibration pattern for mobile / Android devices
 */
export function vibrateDevice(pattern: number[] = [250, 100, 250, 100, 400]): void {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}
