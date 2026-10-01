'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { LANGUAGES, languageLabel } from '@/lib/ai/languages';
import { useMotionPresets } from '@/lib/motion';

type Props = {
  /** Language code, or '' when the untranslated original is showing. */
  value: string;
  onChange: (code: string) => void;
  /** Renders a first row that returns to the original. */
  onOriginal?: () => void;
  /** Adds English as a translation target (reading a translated lesson). */
  includeEnglish?: boolean;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
  /** Show `native · English name` once a language is active (needs the room). */
  showPair?: boolean;
  /** Tooltip saying what the pill governs. The pill's own text is a language name, which does not
   *  say whether it re-translates the page or only steers the next answer, and those are different
   *  promises in the two places it appears. */
  hint?: string;
};

/**
 * Curated-language dropdown shared by the lesson translator and the lesson assistant, so both
 * speak the same visual language. Stops pointer events so it stays clickable inside a draggable
 * header.
 */
export function LanguagePicker({ value, onChange, onOriginal, includeEnglish, align = 'left', size = 'md', showPair, hint }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const { popover: menu } = useMotionPresets();
  const current = LANGUAGES.find((l) => l.code === value);
  const label = current ? (showPair ? `${current.native} · ${current.label}` : current.native) : languageLabel(value) ?? 'English';
  const sm = size === 'sm';
  const pick = (code: string) => {
    setOpen(false);
    onChange(code);
  };

  return (
    <div className="relative" ref={box} onPointerDown={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={hint}
        className={clsx(
          'flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface font-semibold shadow-card hover:border-brand',
          sm ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        )}
      >
        <Languages className={clsx('shrink-0 text-brand', sm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        <span className="truncate">{label}</span>
        <ChevronDown className={clsx('shrink-0 text-muted', sm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            {...menu}
            className={clsx(
              'absolute z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-card',
              align === 'right' ? 'end-0' : 'start-0',
              sm ? 'w-52' : 'w-64',
            )}
          >
            {onOriginal && <Item active={!current && value !== 'en'} onClick={() => { setOpen(false); onOriginal(); }} label="English" sub="Original" />}
            {includeEnglish && <Item active={value === 'en'} onClick={() => pick('en')} label="English" sub="Translate to English" />}
            {LANGUAGES.map((l) => (
              <Item key={l.code} active={value === l.code} onClick={() => pick(l.code)} label={l.native} sub={l.label} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Item({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <li>
      <button onClick={onClick} className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm', active ? 'bg-brand-soft text-brand' : 'hover:bg-surface-2')}>
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted">{sub}</span>
        {active && <Check className="ms-auto h-3.5 w-3.5" />}
      </button>
    </li>
  );
}
