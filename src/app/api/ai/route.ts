import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AI_FAST_MODEL, AI_MODEL, acquireAiSlot, aiConfigured, getAiClient, isNativeClaude, transcriptionConfigured } from '@/lib/ai/server';
import { QUOTA_LIMITS, chargeAi, humanize, limitLabel } from '@/lib/ai/quota';
import { TASK_PROMPTS, TRANSLATOR_SYSTEM, TUTOR_SYSTEM, translateInstructions, type AiTask } from '@/lib/ai/prompts';
import { languageLabel } from '@/lib/ai/languages';
import { getTopic } from '@/content/registry';

export const runtime = 'nodejs';

type Body = {
  task?: AiTask;
  sql?: string;
  error?: string;
  question?: string;
  schema?: string;
  /** Lesson slug: 'ask' / 'simplify' get the lesson as context; 'translate' translates it. */
  lesson?: string;
  /** Selected passage for 'simplify' / 'translateText'. */
  text?: string;
  /** Target language code for 'translate' / 'translateText'. */
  language?: string;
  /** Raw JSON plan for 'explainPlan'. */
  plan?: string;
};

const TASKS = new Set<AiTask>(['complete', 'explain', 'fix', 'ask', 'write', 'review', 'simplify', 'translateText', 'translate', 'explainPlan']);

export function GET() {
  return Response.json({ enabled: aiConfigured(), model: AI_MODEL, transcription: transcriptionConfigured(), quota: QUOTA_LIMITS });
}

/** Lesson MDX source, only for slugs in the registry (never an arbitrary path). */
async function lessonSource(slug: string | undefined) {
  if (!slug || !getTopic(slug)) return null;
  return readFile(path.join(process.cwd(), 'src/content/topics', `${slug}.mdx`), 'utf8');
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const task = body.task;
  if (!task || !TASKS.has(task)) return Response.json({ error: 'Unknown task.' }, { status: 400 });
  if ((body.sql?.length ?? 0) > 50_000 || (body.question?.length ?? 0) > 5_000 || (body.text?.length ?? 0) > 8_000) {
    return Response.json({ error: 'Input too large.' }, { status: 413 });
  }

  // Spend the visitor's budget before the model is reached. It sits after the task and size checks
  // on purpose: a malformed request must cost nothing, so the only way to drain an allowance is to
  // ask for real work.
  const quota = chargeAi(request, task);
  if (!quota.allowed) {
    return Response.json(
      {
        error:
          quota.limit === 'translate'
            ? `You have used this hour's whole-lesson translations — the next one is free in ${humanize(quota.retryAfterSec)}. Raise AI_TRANSLATE_PER_HOUR in .env.local if this is your own deployment.`
            : `You have used your AI allowance for the ${limitLabel(quota.limit)} — ${quota.retryAfterSec <= 90 ? 'the next request is free in ' : 'try again in '}${humanize(quota.retryAfterSec)}, or raise AI_REQUESTS_PER_HOUR in .env.local if this is your own deployment.`,
      },
      { status: 429, headers: { 'retry-after': String(quota.retryAfterSec), 'x-quota-limit': quota.limit } },
    );
  }

  const topic = body.lesson ? getTopic(body.lesson) : undefined;
  let system = TUTOR_SYSTEM;
  let content: string;
  let maxTokens = 8000;

  if (task === 'translate') {
    const language = languageLabel(body.language);
    const source = await lessonSource(body.lesson);
    if (!language || !source) return Response.json({ error: 'Unsupported lesson or language.' }, { status: 400 });
    system = TRANSLATOR_SYSTEM;
    content = `${translateInstructions(language)}\n\n${source}`;
    maxTokens = 32_000;
  } else if (task === 'translateText') {
    const language = languageLabel(body.language);
    if (!language || !body.text) return Response.json({ error: 'Unsupported language.' }, { status: 400 });
    system = TRANSLATOR_SYSTEM;
    content = TASK_PROMPTS.translateText({ text: body.text, language });
  } else {
    content = TASK_PROMPTS[task]({ ...body, lesson: topic?.title });
    // Lesson-aware answers: ground 'ask' and 'simplify' in the lesson the learner is reading.
    if (topic && (task === 'ask' || task === 'simplify')) {
      const source = await lessonSource(body.lesson);
      if (source) content += `\n\nThe learner is reading the lesson "${topic.title}". Lesson source (MDX) for context:\n${source.slice(0, 24_000)}`;
    }
    if (body.schema) content += `\n\nCurrent database schema (live introspection):\n${body.schema.slice(0, 20_000)}`;
    if (task === 'complete') maxTokens = 1024;
  }

  const client = getAiClient();
  const model = task === 'complete' ? AI_FAST_MODEL : AI_MODEL;
  const release = await acquireAiSlot();

  // Native Claude ids get refusal fallbacks, effort and prompt caching; gateway aliases
  // (e.g. CLAUDE_MODEL=coder) get a plain Messages request they are known to accept.
  const stream = isNativeClaude(model)
    ? client.beta.messages.stream({
        model,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Completions must feel instant; everything else gets a bit more room to reason.
        output_config: { effort: task === 'complete' ? 'low' : 'medium' },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
      })
    : client.messages.stream({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] });

  const encoder = new TextEncoder();
  let started = false;
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            // Some gateway models prefix the stream with blank lines; drop them once.
            const text = started ? event.delta.text : event.delta.text.replace(/^\s*\n/, '');
            if (!text) continue;
            started = true;
            controller.enqueue(encoder.encode(text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode('\n\n_The assistant declined this request._'));
        if (final.stop_reason === 'max_tokens') controller.enqueue(encoder.encode('\n\n_(Answer truncated: it hit the length limit.)_'));
        // Token-usage trailer: parsed and stripped by streamAi, invisible in the rendered answer.
        const u = final.usage;
        if (u) controller.enqueue(encoder.encode(`\n\n<!--u:${JSON.stringify({ i: u.input_tokens, o: u.output_tokens })}-->`));
      } catch (error) {
        const message =
          error instanceof Anthropic.AuthenticationError ? 'AI authentication failed: check ANTHROPIC_API_KEY / ANTHROPIC_AUTH_SCHEME in .env.local.'
          : error instanceof Anthropic.RateLimitError ? 'AI rate limit reached — try again in a moment.'
          : error instanceof Anthropic.APIError ? `AI error ${error.status}: ${error.message}`
          : 'AI request failed.';
        controller.enqueue(encoder.encode(`\n\n**Error:** ${message}`));
      } finally {
        release();
        controller.close();
      }
    },
    cancel() {
      stream.abort();
      release();
    },
  });

  return new Response(readable, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-quota-remaining': String(quota.remaining) },
  });
}
