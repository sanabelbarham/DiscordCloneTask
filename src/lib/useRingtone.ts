import { useEffect } from "react";

const RING_INTERVAL_MS = 2_000;

/** Plays a repeating two-tone ring while `active` is true. Synthesized via
 * Web Audio API so no external audio asset is needed. */
export function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const ctx = new AudioContext();

    function ring() {
      const now = ctx.currentTime;
      for (const offset of [0, 0.3]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.2, now + offset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.3);
      }
    }

    ring();
    const interval = setInterval(ring, RING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      void ctx.close();
    };
  }, [active]);
}
