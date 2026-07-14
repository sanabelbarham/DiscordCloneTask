import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

const SPEAKING_VOLUME_THRESHOLD = 12; // 0-255 scale from AnalyserNode byte data
const POLL_INTERVAL_MS = 200;

interface AnalyserEntry {
  audioContext: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array;
}

/**
 * Client-only speaking-indicator computation (research.md §3, data-model.md
 * §callParticipants): once a peer's audio is flowing over WebRTC, "who is
 * speaking" is derived locally from that already-arriving MediaStream via a
 * Web Audio AnalyserNode — no Convex table, mutation, or query involved.
 */
export function useSpeakingDetection(streams: Map<Id<"users"> | "local", MediaStream>) {
  const [speaking, setSpeaking] = useState<Map<Id<"users"> | "local", boolean>>(new Map());
  const analysersRef = useRef<Map<Id<"users"> | "local", AnalyserEntry>>(new Map());

  useEffect(() => {
    const analysers = analysersRef.current;

    for (const [key, stream] of streams) {
      if (analysers.has(key)) continue;
      if (stream.getAudioTracks().length === 0) continue;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analysers.set(key, { audioContext, analyser, data: new Uint8Array(analyser.frequencyBinCount) });
    }

    for (const key of Array.from(analysers.keys())) {
      if (!streams.has(key)) {
        void analysers.get(key)?.audioContext.close();
        analysers.delete(key);
      }
    }
  }, [streams]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = new Map<Id<"users"> | "local", boolean>();
      for (const [key, entry] of analysersRef.current) {
        entry.analyser.getByteFrequencyData(entry.data);
        const average = entry.data.reduce((sum, v) => sum + v, 0) / entry.data.length;
        next.set(key, average > SPEAKING_VOLUME_THRESHOLD);
      }
      setSpeaking(next);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // analysersRef is plain mutable instance state (not a DOM node ref), so
    // reading `.current` at unmount time is intentional here.
    /* eslint-disable react-hooks/exhaustive-deps */
    return () => {
      analysersRef.current.forEach((entry) => void entry.audioContext.close());
      analysersRef.current.clear();
    };
    /* eslint-enable react-hooks/exhaustive-deps */
  }, []);

  return speaking;
}
