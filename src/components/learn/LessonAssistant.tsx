'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { STILL, useMotionPresets } from '@/lib/motion';
import clsx from 'clsx';
import { BookOpenText, Crosshair, GripVertical, Languages, MessageCircleQuestion, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useAiEnabled, type AiPayload, type AiTask } from '@/lib/ai/client';
import { languageLabel } from '@/lib/ai/languages';
import { AiAnswer } from '@/components/ai/AiAnswer';
import { LanguagePicker } from '@/components/ai/LanguagePicker';
import { useAiFontSize } from '@/components/ai/useAiFontSize';
import { clearAiCache } from '@/components/ai/useAiAnswer';
import { VoiceButton } from '@/components/ai/VoiceButton';

type Request = { id: number; task: AiTask; title: string; payload: AiPayload };
type Selection = { text: string; x: number; y: number } | null;
type Pos = { x: number; y: number };

const PREF_KEY = 'postgres-lab:lang';
const POS_KEY = 'postgres-lab:copilot:pos';

/* Draggable copilot geometry, same shape as the research repo's copilot launcher. */
const EDGE = 8;
const FAB = 52;
const PANEL_W = 420;
const PANEL_H = 620;
const GAP = 12;
const DRAG_THRESHOLD = 4;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const restPos = (): Pos => ({ x: window.innerWidth - FAB - 24, y: window.innerHeight - FAB - 24 });
const clampPos = (p: Pos): Pos => ({
  x: clamp(p.x, EDGE, Math.max(EDGE, window.innerWidth - FAB - EDGE)),
  y: clamp(p.y, EDGE, Math.max(EDGE, window.innerHeight - FAB - EDGE)),
});
const flipFor = (p: Pos) => ({ left: p.x + FAB / 2 > window.innerWidth / 2, up: p.y + FAB / 2 > window.innerHeight / 2 });

/** Panel anchored next to the launcher, flipping to whichever side has room. */
function panelBox(pos: Pos, flip: { left: boolean; up: boolean }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_W, vw - 2 * EDGE);
  const height = Math.min(PANEL_H, vh - 2 * EDGE);
  return {
    width,
    height,
    left: clamp(flip.left ? pos.x - width - GAP : pos.x + FAB + GAP, EDGE, Math.max(EDGE, vw - width - EDGE)),
    top: clamp(flip.up ? pos.y + FAB - height : pos.y, EDGE, Math.max(EDGE, vh - height - EDGE)),
  };
}

/**
 * Lesson-aware AI helper: a floating "Ask this lesson" panel (typed or spoken questions, answered
 * with the lesson as context) plus a toolbar on selected text: explain simpler, translate, ask.
 */
export function LessonAssistant({ slug, title }: { slug: string; title: string }) {
  const aiEnabled = useAiEnabled();
  useAiFontSize(); // publishes --ai-fs as soon as any AI UI is on the page
  // The copilot's spring and popovers are its personality, so they stay; `still` is the one thing
  // they must give up when the visitor asked for reduced motion (spread last, so it wins).
  const { still, popover: selectionBar } = useMotionPresets();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [requests, setRequests] = useState<Request[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  // English until a saved preference is read: the picker and the answers must agree, so a fresh
  // visitor sees English selected and gets English answers.
  const [lang, setLang] = useState('en');
  const list = useRef<HTMLDivElement>(null);

  /* ── movable copilot ──────────────────────────────────────────────────────
     One position drives both the launcher and the panel, so dragging either one
     moves the whole copilot. Null until mounted (CSS keeps it bottom-right). */
  const [pos, setPos] = useState<Pos | null>(null);
  const posRef = useRef<Pos | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const flip = useRef({ left: true, up: true });

  const moveTo = (next: Pos) => {
    const p = clampPos(next);
    posRef.current = p;
    setPos(p);
  };

  useEffect(() => {
    let start = restPos();
    try {
      const saved = localStorage.getItem(POS_KEY);
      const parsed = saved ? (JSON.parse(saved) as Pos) : null;
      if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) start = clampPos(parsed);
    } catch {}
    moveTo(start);
    // Re-clamp when the window shrinks, so the copilot can never be stranded off-screen.
    const onResize = () => posRef.current && moveTo(posRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const grab = (e: React.PointerEvent, skipControls = false) => {
    const current = posRef.current;
    if (!current) return;
    if (skipControls && (e.target as HTMLElement).closest('button,select,input,textarea,a')) return;
    flip.current = flipFor(current);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: current.x, oy: current.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const dragTo = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    moveTo({ x: d.ox + dx, y: d.oy + dy });
  };

  /** A press that never moved is a tap; a drag remembers where the copilot was left. */
  const release = (e: React.PointerEvent, tap?: () => void) => {
    const d = drag.current;
    drag.current = null;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (!d.moved) {
      tap?.();
      return;
    }
    if (posRef.current) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
      } catch {}
    }
  };

  const resetPos = () => {
    moveTo(restPos());
    try {
      localStorage.removeItem(POS_KEY);
    } catch {}
  };

  useEffect(() => {
    try {
      setLang(localStorage.getItem(PREF_KEY) || 'en');
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

  /**
   * The panel's language picker governs every answer, so the code rides on all of them: an ask
   * picked up in Hindi must arrive in Hindi. `translateText` carries its own target, which wins.
   */
  const push = (task: AiTask, title: string, payload: AiPayload) => {
    setOpen(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setRequests((r) => [...r, { id: Date.now(), task, title, payload: { lesson: slug, language: lang, ...payload } }].slice(-8));
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
            {...selectionBar}
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

      {/* launcher: tap opens/closes, drag moves the copilot, double-click sends it home */}
      <button
        onPointerDown={(e) => grab(e)}
        onPointerMove={dragTo}
        onPointerUp={(e) => release(e, () => setOpen((v) => !v))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        title="Lesson assistant: drag me anywhere"
        aria-label={open ? 'Close lesson assistant' : 'Ask this lesson'}
        style={{ width: FAB, height: FAB, ...(pos ? { top: pos.y, left: pos.x, right: 'auto' as const, bottom: 'auto' as const } : {}) }}
        className={clsx(
          'fixed z-40 grid touch-none cursor-grab place-items-center rounded-full bg-accent text-white shadow-[0_12px_30px_-8px_var(--accent)] transition-transform active:cursor-grabbing active:scale-95',
          !pos && 'bottom-6 right-6',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            {...(still ? STILL : {})}
            style={pos ? panelBox(pos, flip.current) : { right: 24, bottom: 88, width: PANEL_W, height: PANEL_H }}
            className="fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
          >
            <header
              onPointerDown={(e) => {
                const t = e.target as HTMLElement;
                if (t.closest('button,select,input,a')) return;
                grab(e, true);
              }}
              onPointerMove={dragTo}
              onPointerUp={(e) => release(e)}
              title="Drag me to move the assistant"
              className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-line px-3 py-3 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted" />
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-sm font-bold">Lesson assistant</div>
                <div className="truncate text-[11px] text-muted">Answers use “{title}” as context</div>
              </div>
              <span className="ml-auto">
                <LanguagePicker
                  align="right"
                  size="sm"
                  includeEnglish
                  hint="Answer language"
                  value={lang}
                  onChange={(code) => {
                    setLang(code);
                    try {
                      localStorage.setItem(PREF_KEY, code);
                    } catch {}
                  }}
                />
              </span>
              {requests.length > 0 && (
                <button
                  onClick={() => {
                    setRequests([]);
                    clearAiCache();
                  }}
                  aria-label="Clear answers"
                  title="Clear answers (forgets the cached ones too, so re-asking uses the AI)"
                  className="rounded-lg p-1 text-muted hover:bg-surface-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={resetPos} aria-label="Move back to the corner" title="Move back to the corner" className="rounded-lg p-1 text-muted hover:bg-surface-2"><Crosshair className="h-4 w-4" /></button>
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
