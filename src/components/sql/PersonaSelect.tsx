'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { Icon } from '@/components/icons';
import { PERSONAS } from '@/lib/sql/session';

type Props = { value: string; onChange: (id: string) => void; prefix?: string; align?: 'left' | 'right' };

/** "Run as…" picker with persona icons (native <select> can't render SVG). */
export function PersonaSelect({ value, onChange, prefix, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = PERSONAS.find((p) => p.id === value) ?? PERSONAS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold hover:border-brand"
      >
        {/* The prefix is the first thing dropped on a phone row (T5-6): the icon + name read fine. */}
        {prefix && <span className="text-muted max-sm:hidden">{prefix}</span>}
        <Icon name={current.icon} className="text-brand" size={15} />
        <span className="max-w-[11rem] truncate">{current.label}</span>
        <ChevronDown className={clsx('h-3.5 w-3.5 text-muted transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={clsx('absolute z-30 mt-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-card', align === 'right' ? 'right-0' : 'left-0')}
          >
            {PERSONAS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === value}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold', p.id === value ? 'bg-brand-soft text-brand' : 'hover:bg-surface-2')}
                >
                  <Icon name={p.icon} size={16} className="text-brand" />
                  <span className="flex-1">{p.label}</span>
                  {p.role && <span className="font-mono text-[10px] font-normal text-muted">{p.role}</span>}
                  {p.id === value && <Check className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
