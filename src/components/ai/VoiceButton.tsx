'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionValue, useTransform } from 'motion/react';
import { STILL, useMotionPresets } from '@/lib/motion';
import clsx from 'clsx';
import { Loader2, Mic, Square } from 'lucide-react';
import { useAiStatus } from '@/lib/ai/client';
import { useVoiceLevel } from '@/components/ai/useVoiceLevel';

type Props = {
  /** Receives the transcript (final text). */
  onText: (text: string) => void;
  /** Optional two-letter language hint (e.g. 'hi') for better recognition. */
  language?: string;
  className?: string;
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

/**
 * The browser reports a bare code like `audio-capture`; the reader needs the reason and the fix.
 * `service-not-allowed` and `network` are the ones that bite offline or in automation.
 */
const VOICE_ERRORS: Record<string, string> = {
  'audio-capture': 'No microphone found. Choose an input device for this site, or set TRANSCRIPTION_* to record on the server.',
  'not-allowed': 'Microphone blocked for this site. Allow it at the address-bar icon, then try again.',
  'service-not-allowed': "This browser blocked its speech service. Enable Google speech in Chrome's settings, or set TRANSCRIPTION_*.",
  network: "Can't reach the browser's speech service (offline or blocked). Type the question, or set TRANSCRIPTION_*.",
  'language-not-supported': "This browser can't recognise that language. Pick English, or set TRANSCRIPTION_*.",
  'no-speech': 'Heard nothing. Tap the mic and speak.',
  aborted: '',
};

const voiceError = (code: string) => (code in VOICE_ERRORS ? VOICE_ERRORS[code] : code ? `Voice input failed (${code}).` : 'Voice input failed.');

/**
 * The quiet failure: mic indicator lit, capture ended, zero words, zero error codes. Chrome's
 * speech recognition is a network service, so this is almost always the service being blocked,
 * not the microphone. Worth saying, because "it stopped and told me nothing" reads as a broken mic.
 */
const SILENT_END =
  'Microphone is live, but no words came back. Chrome sends speech to Google to be recognised. Allow that service (or set TRANSCRIPTION_* to use the server), or type the question.';

/** Hard cap on one capture, so the mic can never stay red forever. Visible as a countdown. */
const CAPTURE_MS = 15000;
const TICK_MS = 200;

/**
 * Speak instead of type. Uses the server's Whisper-compatible transcription when configured
 * (TRANSCRIPTION_API_KEY), otherwise the browser's built-in speech recognition.
 * While capturing it shows a live bubble: pulsing bars, seconds left, draining bar.
 */
export function VoiceButton({ onText, language, className }: Props) {
  const { transcription } = useAiStatus();
  // The capture bubble springs (it is a live instrument, not a menu), so only `still` is taken from
  // the shared layer; spread last, so reduced motion wins over the inline spring.
  const { still } = useMotionPresets();
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(CAPTURE_MS);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const heard = useRef(false);
  /** True once this capture has produced a message, so a silent end doesn't stack a second one. */
  const messaged = useRef(false);
  const [supported, setSupported] = useState(true);
  /** Only the server path has a stream to spare; the browser path must not open a second one. */
  const [meterFrom, setMeterFrom] = useState<MediaStream | null>(null);
  const { level, live } = useVoiceLevel(state === 'recording' && Boolean(meterFrom), meterFrom);
  const ring = useTransform(level, [0, 1], [1, 1.55]);

  /* Ask the OS before trusting the button: with no input device at all the mic is a trap:
     the browser fails with `audio-capture` and nothing the reader taps can fix that. */
  useEffect(() => {
    let alive = true;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const canRecord = typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined';
    const hasApi = transcription ? canRecord : Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
    if (!navigator.mediaDevices?.enumerateDevices) {
      setSupported(hasApi);
      return () => {
        alive = false;
      };
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((d) => alive && setSupported(hasApi && d.some((x) => x.kind === 'audioinput')))
      .catch(() => alive && setSupported(hasApi));
    return () => {
      alive = false;
    };
  }, [transcription]);

  const disarm = () => {
    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  };

  /**
   * Ends one capture. Both stops are wrapped: Chrome throws InvalidStateError out of
   * `SpeechRecognition.stop()` when its speech service never came up, and that throw used to
   * swallow the state reset below it, leaving the button red with no message, forever.
   */
  const stopCapture = (code?: string) => {
    disarm();
    try {
      if (recorder.current?.state === 'recording') recorder.current.stop();
    } catch {}
    try {
      recognition.current?.stop();
    } catch {}
    setLeft(CAPTURE_MS);
    setMeterFrom(null);
    setState('idle');
    if (code) {
      const msg = voiceError(code);
      if (msg) {
        messaged.current = true;
        setError(msg);
      }
    }
  };

  /** Countdown that drives the UI every tick and ends the capture at zero. */
  const arm = (audioCaptured = false) => {
    heard.current = audioCaptured;
    messaged.current = false;
    disarm();
    setLeft(CAPTURE_MS);
    const t0 = Date.now();
    ticker.current = setInterval(() => {
      const left = CAPTURE_MS - (Date.now() - t0);
      setLeft(Math.max(0, left));
      if (left <= 0) stopCapture(heard.current ? undefined : 'no-speech');
    }, TICK_MS);
  };

  useEffect(() => () => {
    disarm();
    try {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      recognition.current?.stop();
    } catch {}
  }, []);

  const startServer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    recorder.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      disarm();
      stream.getTracks().forEach((t) => t.stop());
      setState('working');
      try {
        const form = new FormData();
        form.append('audio', new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        if (language) form.append('language', language);
        const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !data.text) throw new Error(data.error ?? 'Transcription failed');
        onText(data.text);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Transcription failed');
      } finally {
        setState('idle');
      }
    };
    rec.start();
    setMeterFrom(stream);
    setState('recording');
    // The cap on this path is a stop + transcribe, not a "heard nothing" warning.
    arm(true);
  };

  const startBrowser = () => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return setError('Voice input is not supported in this browser.');
    const rec = new Ctor();
    rec.lang = language ? `${language}-IN` : navigator.language;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
      if (text) {
        heard.current = true;
        onText(text);
      }
    };
    rec.onerror = (e) => stopCapture(e.error);
    rec.onend = () => {
      const silent = !heard.current;
      stopCapture();
      if (silent && !messaged.current) setError(SILENT_END);
    };
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      stopCapture('audio-capture');
      return;
    }
    setState('recording');
    arm();
  };

  /** getUserMedia names its failures; the reader needs the one they can act on. */
  const captureError = (e: unknown) => {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return voiceError('not-allowed');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return voiceError('audio-capture');
    if (name === 'NotReadableError') return 'Your microphone is in use by another app. Close it and try again.';
    return 'Could not start recording. Check the microphone, then try again.';
  };

  const toggle = async () => {
    setError(null);
    if (state === 'recording') return stopCapture();
    try {
      if (transcription) await startServer();
      else startBrowser();
    } catch (e) {
      stopCapture();
      setError(captureError(e));
    }
  };

  if (!supported) return null;
  const secs = Math.ceil(left / 1000);

  return (
    <span className={clsx('relative inline-flex', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={state === 'working'}
        title={state === 'recording' ? `Stop recording (${secs}s left)` : `Speak (${transcription ? 'server transcription' : 'browser speech recognition'})`}
        aria-label={state === 'recording' ? `Stop recording, ${secs} seconds left` : 'Speak your question'}
        aria-live={state === 'recording' ? 'polite' : undefined}
        className={clsx(
          'relative grid h-8 w-8 place-items-center rounded-lg transition',
          state === 'recording' ? 'bg-bad text-white' : 'text-muted hover:bg-surface-2 hover:text-text',
        )}
      >
        {/* ripple + breathing icon while the mic is open; the third ring tracks the real voice level */}
        {state === 'recording' && (
          <>
            <motion.span className="absolute inset-0 rounded-lg bg-bad/45" style={{ scale: ring, opacity: live ? 0.5 : 0 }} />
            <motion.span className="absolute inset-0 rounded-lg bg-bad" animate={{ scale: [1, 1.6], opacity: [0.55, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }} />
            <motion.span className="absolute inset-0 rounded-lg bg-bad" animate={{ scale: [1, 1.25], opacity: [0.35, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut', delay: 0.35 }} />
          </>
        )}
        {state === 'working' ? (
          <Loader2 className="relative h-4 w-4 animate-spin" />
        ) : state === 'recording' ? (
          <motion.span className="relative grid place-items-center" animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
            <Square className="h-3.5 w-3.5 fill-current" />
          </motion.span>
        ) : (
          <Mic className="relative h-4 w-4" />
        )}
      </button>

      {/* Live capture bubble, opening upward: the copilot panel clips overflow, so anything
          below a mic in its footer would be invisible, exactly when the reader needs it. */}
      <AnimatePresence>
        {state === 'recording' && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            {...(still ? STILL : {})}
            className="pointer-events-none absolute bottom-full end-0 z-30 mb-1.5 w-52 rounded-xl border border-bad/30 bg-surface p-2 shadow-card"
          >
            <div className="flex items-center gap-2">
              <motion.span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bad text-white" animate={{ opacity: [1, 0.65, 1] }} transition={{ duration: 1.1, repeat: Infinity }}>
                <Mic className="h-3.5 w-3.5" />
              </motion.span>
              <WaveBars level={level} live={live} />
              <span className="ms-auto shrink-0 text-xs font-bold tabular-nums text-bad">{secs}s</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bad/15">
              <motion.div
                className="h-full rounded-full bg-bad"
                initial={false}
                animate={{ width: `${(left / CAPTURE_MS) * 100}%` }}
                transition={{ duration: TICK_MS / 1000 + 0.06, ease: 'linear' }}
              />
            </div>
            <div className="mt-1 text-[10px] font-semibold text-muted">Listening… tap {`■`} to stop, {secs}s max</div>
          </motion.div>
        )}
      </AnimatePresence>

      {state !== 'recording' && error && (
        <motion.span
          role="alert"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          {...(still ? STILL : {})}
          className="absolute bottom-full end-0 z-30 mb-1.5 w-56 cursor-pointer rounded-lg bg-bad-soft px-2 py-1 text-start text-[11px] font-semibold text-bad shadow-card"
          onClick={() => setError(null)}
        >
          {error}
        </motion.span>
      )}
    </span>
  );
}

const BAR_COUNT = 21;

/**
 * The mic's own waveform: a rolling window of real levels, newest sample at the right, pushed left
 * every 55 ms. Values are MotionValues, so a 60 fps analyser costs zero React renders.
 * Falls back to a decorative cycle when the analyser never started (no permission, no AudioContext).
 */
function WaveBars({ level, live }: { level: MotionValue<number>; live: boolean }) {
  // Built in a ref, not with useMotionValue: a hook inside Array.from changes the hook count
  // between renders (useMemo skips its callback), which React rejects outright.
  const bars = useRef<MotionValue<number>[]>([]);
  if (bars.current.length === 0) bars.current = Array.from({ length: BAR_COUNT }, () => new MotionValue<number>(0.12));

  useEffect(() => {
    if (!live) return;
    const vals = bars.current;
    const id = setInterval(() => {
      for (let i = 0; i < vals.length - 1; i++) vals[i].set(vals[i + 1].get());
      vals[vals.length - 1].set(Math.max(0.1, Math.min(1, level.get() * 1.25)));
    }, 55);
    return () => clearInterval(id);
  }, [live, level]);

  if (!live) {
    const delays = [0, 0.18, 0.36, 0.12, 0.28];
    return (
      <span className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
        {delays.map((delay, i) => (
          <motion.span
            key={i}
            className="w-[3px] max-w-[4px] flex-1 origin-center rounded-full bg-bad/70"
            animate={{ scaleY: [0.3, 1, 0.55, 0.9, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay }}
          />
        ))}
      </span>
    );
  }

  return (
    <span className="flex h-6 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden>
      {bars.current.map((b, i) => (
        <motion.span key={i} style={{ scaleY: b }} className="h-5 w-[3px] shrink-0 origin-center rounded-full bg-bad/80" />
      ))}
    </span>
  );
}
