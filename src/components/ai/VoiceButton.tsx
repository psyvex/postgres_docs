'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { Loader2, Mic, Square } from 'lucide-react';
import { useAiStatus } from '@/lib/ai/client';

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
 * Speak instead of type. Uses the server's Whisper-compatible transcription when configured
 * (TRANSCRIPTION_API_KEY), otherwise the browser's built-in speech recognition (Chrome, Edge, Safari).
 */
export function VoiceButton({ onText, language, className }: Props) {
  const { transcription } = useAiStatus();
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean(transcription ? navigator.mediaDevices?.getUserMedia : w.SpeechRecognition || w.webkitSpeechRecognition));
  }, [transcription]);

  useEffect(() => () => {
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recognition.current?.stop();
  }, []);

  const startServer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    recorder.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
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
    setState('recording');
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
      if (text) onText(text);
    };
    rec.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone permission denied.' : `Voice input error: ${e.error}`);
    rec.onend = () => setState('idle');
    recognition.current = rec;
    rec.start();
    setState('recording');
  };

  const toggle = async () => {
    setError(null);
    if (state === 'recording') {
      recorder.current?.state === 'recording' && recorder.current.stop();
      recognition.current?.stop();
      return;
    }
    try {
      if (transcription) await startServer();
      else startBrowser();
    } catch {
      setError('Microphone permission denied.');
      setState('idle');
    }
  };

  if (!supported) return null;
  return (
    <span className={clsx('relative inline-flex', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={state === 'working'}
        title={state === 'recording' ? 'Stop recording' : `Speak (${transcription ? 'server transcription' : 'browser speech recognition'})`}
        aria-label={state === 'recording' ? 'Stop recording' : 'Speak your question'}
        className={clsx(
          'relative grid h-8 w-8 place-items-center rounded-lg transition',
          state === 'recording' ? 'bg-bad text-white' : 'text-muted hover:bg-surface-2 hover:text-text',
        )}
      >
        {state === 'recording' && <motion.span className="absolute inset-0 rounded-lg bg-bad" animate={{ scale: [1, 1.35], opacity: [0.5, 0] }} transition={{ duration: 1, repeat: Infinity }} />}
        {state === 'working' ? <Loader2 className="relative h-4 w-4 animate-spin" /> : state === 'recording' ? <Square className="relative h-3.5 w-3.5 fill-current" /> : <Mic className="relative h-4 w-4" />}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg bg-bad-soft px-2 py-1 text-[11px] text-bad shadow-card" onClick={() => setError(null)}>
          {error}
        </span>
      )}
    </span>
  );
}
