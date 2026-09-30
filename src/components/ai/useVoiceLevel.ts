'use client';

import { useEffect, useState } from 'react';
import { useMotionValue } from 'motion/react';

type AudioCtor = typeof AudioContext;

/**
 * Live mic level (0..1) for the recording UI, written to a MotionValue so the bars animate without
 * a React render every frame.
 *
 * Meters ONLY a stream the caller already owns, and never opens one of its own. Asking for the
 * microphone a second time while the Web Speech API is already capturing it is how you get a lit
 * mic indicator, a red button and no transcript — on macOS Chrome that contention is real. So the
 * browser-speech path passes no stream and keeps its decorative bars: a visual is not worth
 * competing with the component that produces the words. The server path already holds the stream
 * MediaRecorder is recording, so it meters for free.
 *
 * `live` stays false whenever the meter cannot start (no source, permission, AudioContext), so the
 * caller draws its fallback instead of a dead flat line.
 */
export function useVoiceLevel(active: boolean, source: MediaStream | null | undefined) {
  const level = useMotionValue(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    level.set(0);
    if (!active || !source) {
      setLive(false);
      return;
    }
    let disposed = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return;

    (async () => {
      try {
        ctx = new Ctor();
        if (ctx.state === 'suspended') await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        ctx.createMediaStreamSource(source).connect(analyser);
        // An AnalyserNode is not a sink: a graph that ends in one is never pulled, so it reports
        // silence. This zero-gain tail keeps the graph running and stays inaudible.
        const sink = ctx.createGain();
        sink.gain.value = 0;
        analyser.connect(sink).connect(ctx.destination);
        const buf = new Uint8Array(analyser.fftSize);
        setLive(true);
        const sample = () => {
          if (disposed) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          // RMS, then a saturating curve: linear gain pins every bar at 1 as soon as someone
          // speaks loudly, and a wall of full-height bars shows no spikes at all. This keeps
          // quiet speech off the floor and loud speech inside the range (~0.19 at rms 0.05,
          // 0.57 at 0.2, 0.92 at 0.6) without ever reaching exactly 1.
          level.set(1 - Math.exp(-Math.sqrt(sum / buf.length) * 4.2));
          raf = requestAnimationFrame(sample);
        };
        sample();
      } catch {
        setLive(false);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
      level.set(0);
      setLive(false);
    };
  }, [active, source, level]);

  return { level, live };
}
