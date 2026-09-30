'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Wand2, X } from 'lucide-react';
import { streamAi, stripFence } from '@/lib/ai/client';
import { highlightSql } from '@/lib/sql/highlight';
import { VoiceButton } from '@/components/ai/VoiceButton';

type Props = {
  /** Current editor SQL (sent as context). */
  sql: string;
  schemaText: string;
  /** Receives the finished SQL; the caller inserts it into the editor as one undoable edit. */
  onWrite: (sql: string) => void;
};

const EXAMPLES = ['tasks per org with % done', 'policy: members update only their own tasks', 'audit trigger for projects', 'who can SELECT on tasks?'];

/** "Describe what you want" → SQL, streamed with a live preview, then applied to the editor. */
export function WriteBar({ sql, schemaText, onWrite }: Props) {
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const write = async (text = prompt) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setDraft('');
    const controller = new AbortController();
    abort.current = controller;
    try {
      const out = await streamAi('write', { question: text, sql, schema: schemaText }, (t) => setDraft(stripFence(t)), controller.signal);
      const clean = stripFence(out).trim();
      if (clean && !clean.includes('**Error:**')) onWrite(clean);
      else setDraft(clean || 'No SQL returned.');
    } catch (e) {
      if (!controller.signal.aborted) setDraft(`-- ${e instanceof Error ? e.message : 'AI request failed'}`);
    } finally {
      setBusy(false);
      if (!controller.signal.aborted) setTimeout(() => setDraft(null), 1200);
    }
  };

  return (
    <div className="relative border-b border-line bg-surface-2/60 px-3 py-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          write();
        }}
        className="flex items-center gap-2"
      >
        <Wand2 className="h-4 w-4 shrink-0 text-accent" />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want, e.g. “tasks per org with % done” — AI writes the SQL"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          aria-label="Describe the SQL you want"
        />
        <VoiceButton onText={(t) => { setPrompt(t); write(t); }} />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold">
            <X className="h-3.5 w-3.5" /> Stop
          </button>
        ) : (
          <button type="submit" disabled={!prompt.trim()} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
            Write SQL
          </button>
        )}
      </form>
      {!prompt && !busy && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => { setPrompt(ex); write(ex); }} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-muted hover:border-accent hover:text-text">
              {ex}
            </button>
          ))}
        </div>
      )}
      <AnimatePresence>
        {draft !== null && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-3 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-accent/30 bg-code-bg p-3 font-mono text-[calc(var(--ai-fs,15px)*0.85)] leading-relaxed text-code-text shadow-card"
          >
            <div className="mb-1 flex items-center gap-1.5 font-sans text-[11px] font-bold text-accent">
              {busy ? <><Loader2 className="h-3 w-3 animate-spin" /> Writing SQL…</> : 'Inserted into the editor (⌘Z to undo)'}
            </div>
            <pre className="whitespace-pre-wrap">{highlightSql(draft)}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
