'use client';

import { useEffect, useState } from 'react';

export type AiTask = 'complete' | 'explain' | 'fix' | 'ask' | 'write' | 'review' | 'simplify' | 'translateText' | 'translate' | 'explainPlan';
export type AiPayload = { sql?: string; error?: string; question?: string; schema?: string; lesson?: string; text?: string; language?: string; plan?: string };
export type AiStatus = { enabled: boolean; transcription: boolean; model?: string };

let statusPromise: Promise<AiStatus> | null = null;

function loadStatus() {
  statusPromise ??= fetch('/api/ai')
    .then((r) => r.json() as Promise<AiStatus>)
    .catch(() => ({ enabled: false, transcription: false }));
  return statusPromise;
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus>({ enabled: false, transcription: false });
  useEffect(() => {
    loadStatus().then(setStatus);
  }, []);
  return status;
}

export function useAiEnabled() {
  return useAiStatus().enabled;
}

/** Token-usage trailer embedded by the server; parsed and stripped before the text reaches the UI. */
const TRAILER_RE = /\n*<!--u:(\{[^}]+\})-->\s*$/;

/** Streams text from /api/ai, calling onText with the accumulated response. */
export async function streamAi(
  task: AiTask,
  payload: AiPayload,
  onText: (text: string) => void,
  signal?: AbortSignal,
  onUsage?: (u: { i: number; o: number }) => void,
) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, ...payload }),
    signal,
  });
  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => null);
    throw new Error((detail as { error?: string } | null)?.error ?? `AI request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    // Don't expose the trailer to the UI: strip it from every live snapshot.
    onText(text.replace(TRAILER_RE, ''));
  }
  // Final pass: extract usage from the trailer (if present).
  const trailer = text.match(TRAILER_RE);
  if (trailer && onUsage) {
    try { onUsage(JSON.parse(trailer[1]) as { i: number; o: number }); } catch { /* malformed trailer: ignore */ }
  }
  return text.replace(TRAILER_RE, '');
}

/** Strips a single surrounding ``` fence the model may add despite instructions. */
export function stripFence(text: string) {
  return text.replace(/^\s*```[\w-]*\n?/, '').replace(/\n?```\s*$/, '');
}
