'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpenText, Languages, MessageCircleQuestion, Send, Sparkles, X } from 'lucide-react';
import { useAiEnabled, type AiPayload, type AiTask } from '@/lib/ai/client';
import { LANGUAGES, languageLabel } from '@/lib/ai/languages';
import { AiAnswer } from '@/components/ai/AiAnswer';
import { VoiceButton } from '@/components/ai/VoiceButton';

type Request = { id: number; task: AiTask; title: string; payload: AiPayload };
type Selection = { text: string; x: number; y: number } | null;

const PREF_KEY = 'postgres-lab:lang';

/**
 * Lesson-aware AI helper: a floating "Ask this lesson" panel (typed or spoken questions, answered
 * with the lesson as context) plus a toolbar on selected text — explain simpler, translate, ask.
 */
export function LessonAssistant({ slug, title }: { slug: string; title: string }) {
  const aiEnabled = useAiEnabled();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [requests, setRequests] = useState<Request[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [lang, setLang] = useState('hi');
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setLang(localStorage.getItem(PREF_KEY) || 'hi');
    } catch {}
  }, [open]);

  // Selection toolbar: only for text selected inside the lesson prose.
  useEffect(() => {
    if (!aiEnabled) return;
    const onUp = () =>
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? '';
        const node = sel?.anchorNode?.parentElement;
        if (!sel || text.length < 12 || !node?.closest('.prose-lab') || node.closest('.not-prose')) return setSelection(null);
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({ text: text.slice(0, 2000), x: rect.left + rect.width / 2, y: rect.top });
      }, 10);
    const onScroll = () => setSelection(null);
    document.addEventListener('mouseup', onUp);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('scroll', onScroll);
    };
  }, [aiEnabled]);

  const push = (task: AiTask, title: string, payload: AiPayload) => {
    setOpen(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setRequests((r) => [...r, { id: Date.now(), task, title, payload: { lesson: slug, ...payload } }].slice(-8));
    setTimeout(() => list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  const submit = (text = question) => {
    if (!text.trim()) return;
    push('ask', text, { question: text });
    setQuestion('');
  };

  if (!aiEnabled) return null;

  return (
    <>
      {/* selection toolbar */}
      <AnimatePresence>
        {selection && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card"
            style={{ left: selection.x, top: selection.y - 8 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ToolbarButton icon={<BookOpenText className="h-3.5 w-3.5" />} label="Explain simpler" onClick={() => push('simplify', 'Explain simpler', { text: selection.text })} />
            <ToolbarButton
              icon={<Languages className="h-3.5 w-3.5" />}
              label={`Translate · ${languageLabel(lang)}`}
              onClick={() => push('translateText', `Translate to ${languageLabel(lang)}`, { text: selection.text, language: lang })}
            />
            <ToolbarButton icon={<MessageCircleQuestion className="h-3.5 w-3.5" />} label="Ask" onClick={() => { setOpen(true); setQuestion(`About “${selection.text.slice(0, 120)}”: `); setSelection(null); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* launcher */}
      {!open && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-8px_var(--accent)]"
        >
          <Sparkles className="h-4 w-4" /> Ask this lesson
        </motion.button>
      )}

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-6 right-6 z-40 flex h-[min(620px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
          >
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-sm font-bold">Lesson assistant</div>
                <div className="truncate text-[11px] text-muted">Answers use “{title}” as context</div>
              </div>
              <select value={lang} onChange={(e) => { setLang(e.target.value); try { localStorage.setItem(PREF_KEY, e.target.value); } catch {} }} aria-label="Translation language" className="ml-auto max-w-[7.5rem] rounded-lg border border-line bg-bg px-1.5 py-1 text-[11px]">
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
            </header>

            <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {requests.length === 0 && (
                <div className="space-y-2 text-sm text-muted">
                  <p>Ask anything about this lesson, by typing or with the mic. Tip: <b>select any text</b> in the lesson to explain it simpler or translate it.</p>
                  {['Summarize this lesson in 5 bullets', 'Give me a real-world scenario for this', 'Quiz me with 3 questions'].map((s) => (
                    <button key={s} onClick={() => submit(s)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-xs hover:border-accent hover:text-text">{s}</button>
                  ))}
                </div>
              )}
              {requests.map((r) => (
                <div key={r.id} className="space-y-2">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3 py-2 text-xs text-on-brand">{r.title}</div>
                  <AiAnswer task={r.task} title={r.task === 'translateText' ? r.title : r.task === 'simplify' ? 'Explained simply' : 'Answer'} payload={r.payload} onClose={() => setRequests((all) => all.filter((x) => x.id !== r.id))} />
                </div>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-1 border-t border-line p-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                rows={2}
                placeholder="Ask about this lesson…"
                className="min-w-0 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <VoiceButton onText={(t) => setQuestion((q) => (q ? `${q} ${t}` : t))} />
              <button type="submit" disabled={!question.trim()} aria-label="Send" className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-accent-soft hover:text-accent">
      {icon} {label}
    </button>
  );
}
