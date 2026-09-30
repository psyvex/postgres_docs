import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Server-side AI configuration, mirroring the research repo's setup:
 *   ANTHROPIC_API_KEY      key (or gateway token)
 *   ANTHROPIC_BASE_URL     optional Anthropic-compatible gateway; unset = Anthropic directly
 *   ANTHROPIC_AUTH_SCHEME  'x-api-key' (default) or 'bearer' for gateways using Authorization: Bearer
 *   CLAUDE_MODEL           main model, e.g. 'coder' on the gateway (default claude-opus-5-5)
 *   CLAUDE_FAST_MODEL      optional model for latency-sensitive calls (autocomplete); defaults to CLAUDE_MODEL
 *   AI_MAX_CONCURRENCY     max concurrent model calls for the whole process (default 5)
 *   AI_REQUESTS_PER_HOUR   requests one visitor may make per hour (default 60; see lib/ai/quota.ts)
 *   AI_MINUTE_BURST        requests one visitor may make per minute (default 6)
 *   AI_TRANSLATE_PER_HOUR  whole-lesson translations one visitor may make per hour (default 10)
 *   TRANSCRIPTION_API_KEY  optional Whisper-compatible speech-to-text key (research repo contract)
 *   TRANSCRIPTION_API_URL  endpoint (default OpenAI /v1/audio/transcriptions)
 *   TRANSCRIPTION_MODEL    model (default whisper-1)
 */
const env = (key: string) => process.env[key]?.trim() || undefined;

export const AI_MODEL = env('CLAUDE_MODEL') ?? env('ANTHROPIC_MODEL') ?? 'claude-opus-5-5';
export const AI_FAST_MODEL = env('CLAUDE_FAST_MODEL') ?? AI_MODEL;

export function aiConfigured() {
  return Boolean(env('ANTHROPIC_API_KEY') || env('ANTHROPIC_AUTH_TOKEN'));
}

/**
 * Native Anthropic model ids accept Anthropic-only request extras (betas, refusal fallbacks,
 * effort). Gateway aliases such as 'coder' may not, so they get a plain Messages request.
 */
export function isNativeClaude(model: string) {
  return /^claude-/i.test(model);
}

let client: Anthropic | null = null;

export function getAiClient() {
  if (client) return client;
  const key = env('ANTHROPIC_API_KEY') ?? env('ANTHROPIC_AUTH_TOKEN');
  const baseURL = env('ANTHROPIC_BASE_URL');
  const bearer = env('ANTHROPIC_AUTH_SCHEME')?.toLowerCase() === 'bearer';
  // Bearer gateways: send the key as Authorization: Bearer and suppress x-api-key entirely.
  client = bearer
    ? new Anthropic({ apiKey: null, authToken: key, baseURL, maxRetries: 2, timeout: 120_000 })
    : new Anthropic({ apiKey: key, baseURL, maxRetries: 2, timeout: 120_000 });
  return client;
}

/** Tiny process-wide semaphore so a busy playground can't flood the provider. */
const limit = Math.max(1, Number(env('AI_MAX_CONCURRENCY')) || 5);
let active = 0;
const queue: (() => void)[] = [];

export async function acquireAiSlot(): Promise<() => void> {
  if (active >= limit) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active--;
    queue.shift()?.();
  };
}

export const TRANSCRIPTION = {
  key: () => env('TRANSCRIPTION_API_KEY'),
  url: () => env('TRANSCRIPTION_API_URL') ?? 'https://api.openai.com/v1/audio/transcriptions',
  model: () => env('TRANSCRIPTION_MODEL') ?? 'whisper-1',
};

export function transcriptionConfigured() {
  return Boolean(TRANSCRIPTION.key());
}
