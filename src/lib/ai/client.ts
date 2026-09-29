'use client';

import { useEffect, useState } from 'react';

export type AiTask = 'complete' | 'explain' | 'fix' | 'ask' | 'write' | 'review' | 'simplify' | 'translateText' | 'translate';
export type AiPayload = { sql?: string; error?: string; question?: string; schema?: string; lesson?: string; text?: string; language?: string };
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

/** Streams text from /api/ai, calling onText with the accumulated response. */
export async function streamAi(task: AiTask, payload: AiPayload, onText: (text: string) => void, signal?: AbortSignal) {
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
    onText(text);
  }
  return text;
}

/** Strips a single surrounding ``` fence the model may add despite instructions. */
export function stripFence(text: string) {
  return text.replace(/^\s*```[\w-]*\n?/, '').replace(/\n?```\s*$/, '');
}
