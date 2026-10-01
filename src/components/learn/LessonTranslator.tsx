'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';
import clsx from 'clsx';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { streamAi, stripFence, useAiEnabled } from '@/lib/ai/client';
import { LANGUAGES, isRtl, type LanguageCode } from '@/lib/ai/languages';
import { LanguagePicker } from '@/components/ai/LanguagePicker';
import { useMDXComponents } from '@/mdx-components';

const PREF_KEY = 'postgres-lab:lang';
const cacheKey = (slug: string, lang: string, version: string) => `postgres-lab:tr:${slug}:${lang}:${version}`;

type Props = {
  slug: string;
  /** Content hash of the lesson source; cached translations are invalidated when the lesson changes. */
  version: string;
  sourceLength: number;
  /** Lesson meta chips (track, minutes, version); the language picker joins this row. */
  meta?: React.ReactNode;
  /** The original, server-rendered lesson. */
  children: React.ReactNode;
};

type State =
  | { kind: 'original' }
  | { kind: 'streaming'; lang: LanguageCode; chars: number; tail: string }
  | { kind: 'ready'; lang: LanguageCode; Content: ComponentType }
  | { kind: 'error'; lang: LanguageCode; message: string };

/** Compiles translated MDX in the browser with the same components/plugins as the build. */
async function compileMdx(source: string) {
  const [{ evaluate }, runtime, { default: remarkGfm }] = await Promise.all([import('@mdx-js/mdx'), import('react/jsx-runtime'), import('remark-gfm')]);
  const mod = await evaluate(source, { ...runtime, remarkPlugins: [remarkGfm], useMDXComponents } as Parameters<typeof evaluate>[1]);
  return mod.default as ComponentType;
}

/**
 * Lesson language switcher (research repo pattern: curated languages, stream + cache).
 * The lesson MDX is translated by the AI with JSX components and SQL kept verbatim, then compiled
 * here, so animations and runnable examples keep working in the translated lesson.
 */
export function LessonTranslator({ slug, version, sourceLength, meta, children }: Props) {
  const aiEnabled = useAiEnabled();
  // A translation that arrives fully typeset replaces a whole lesson in one frame; the swap is what
  // turns that jump into a hand-over. The progress bar keeps its own width animation.
  const { swap: article, popover: banner } = useMotionPresets();
  const [state, setState] = useState<State>({ kind: 'original' });
  const abort = useRef<AbortController | null>(null);

  // Reset to English when navigating between lessons.
  useEffect(() => () => abort.current?.abort(), [slug]);

  const showOriginal = () => {
    abort.current?.abort();
    setState({ kind: 'original' });
    try {
      localStorage.removeItem(PREF_KEY);
    } catch {}
  };

  const translate = async (lang: LanguageCode, force = false) => {
    abort.current?.abort();
    try {
      localStorage.setItem(PREF_KEY, lang);
    } catch {}
    const key = cacheKey(slug, lang, version);
    let cached: string | null = null;
    try {
      cached = force ? null : localStorage.getItem(key);
    } catch {}
    try {
      if (cached) {
        setState({ kind: 'ready', lang, Content: await compileMdx(cached) });
        return;
      }
      const controller = new AbortController();
      abort.current = controller;
      setState({ kind: 'streaming', lang, chars: 0, tail: '' });
      const raw = await streamAi('translate', { lesson: slug, language: lang }, (t) => setState({ kind: 'streaming', lang, chars: t.length, tail: t.slice(-160) }), controller.signal);
      if (raw.includes('**Error:**')) throw new Error(raw.split('**Error:**').pop()?.trim() || 'Translation failed');
      const mdx = stripFence(raw).trim();
      const Content = await compileMdx(mdx);
      try {
        localStorage.setItem(key, mdx);
      } catch {}
      setState({ kind: 'ready', lang, Content });
    } catch (e) {
      if (abort.current?.signal.aborted) return;
      setState({ kind: 'error', lang, message: e instanceof Error ? e.message : 'Translation failed' });
    }
  };

  const current = state.kind === 'original' ? null : LANGUAGES.find((l) => l.code === state.lang);
  const progress = state.kind === 'streaming' ? Math.min(0.97, state.chars / (sourceLength * 1.15)) : 0;

  return (
    <div>
      {(meta || aiEnabled) && (
        <div className="mb-8 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted">
          {meta}
          {aiEnabled && (
            <>
              <span className="h-4 w-px bg-line" aria-hidden />
              <LanguagePicker
                value={state.kind === 'original' ? '' : state.lang}
                onChange={(code) => translate(code as LanguageCode)}
                onOriginal={showOriginal}
                showPair
              />
              {state.kind === 'ready' && (
                <>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">Translated by AI · code & SQL unchanged</span>
                  <button onClick={() => translate(state.lang, true)} className="flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-text">
                    <RotateCcw className="h-3 w-3" /> Re-translate
                  </button>
                  <button onClick={showOriginal} className="text-[11px] font-semibold text-brand hover:underline">Show original</button>
                </>
              )}
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {state.kind === 'streaming' && (
          <motion.div key="translating" {...banner} className="not-prose mb-6 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Loader2 className="h-4 w-4 animate-spin" /> Translating to {current?.label}… {Math.round(progress * 100)}%
            <button onClick={showOriginal} className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-text">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress * 100}%` }} transition={{ ease: 'easeOut' }} />
          </div>
          <p className="mt-3 line-clamp-2 font-mono text-[11px] text-muted" dir={isRtl(state.lang) ? 'rtl' : undefined}>{state.tail}</p>
          <p className="mt-1 text-[11px] text-muted">The original lesson stays below until the translation is ready. Next time it loads instantly from this browser.</p>
          </motion.div>
        )}

        {state.kind === 'error' && (
          <motion.div key="translation-failed" {...banner} className="not-prose mb-6 rounded-2xl border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
          Translation failed: {state.message}
          <button onClick={() => translate(state.lang, true)} className="ml-3 font-semibold underline">Try again</button>
            <button onClick={showOriginal} className="ml-3 font-semibold underline">Show original</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* `mode="wait"` so the original is gone before the translation is laid out: two whole lessons
          in flow at once would push the page height around under the reader. */}
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === 'ready' ? (
          <motion.article key={`translated-${state.lang}`} {...article} className={clsx('prose-lab', isRtl(state.lang) && '[&_.not-prose]:[direction:ltr]')} dir={isRtl(state.lang) ? 'rtl' : undefined} lang={state.lang}>
            <state.Content />
          </motion.article>
        ) : (
          <motion.article key="original" {...article} dir="ltr" style={{ textAlign: 'left' }} className="prose-lab">{children}</motion.article>
        )}
      </AnimatePresence>
    </div>
  );
}
