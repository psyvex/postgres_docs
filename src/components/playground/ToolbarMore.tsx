'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Check, ChevronDown, MessageSquareText, ShieldCheck, Undo2, Users, Wand2 } from 'lucide-react';

type Props = {
  snippets: { label: string; sql: string }[];
  onSnippet: (sql: string) => void;
  share: React.ReactNode;
  sandbox: boolean;
  onSandbox: (v: boolean) => void;
  onCompare: () => void;
  onRlsMatrix: () => void;
  busy: boolean;
  aiEnabled: boolean;
  aiComplete: boolean;
  onAiComplete: (v: boolean) => void;
  onExplain: () => void;
  onExplainPlan?: () => void;
  onReview: () => void;
};

/**
 * The toolbar's phone form (T5-6). At 375 px the full row of eight controls wrapped to 166 px —
 * a quarter of the screen above the editor — so below `sm` the secondary controls collapse into
 * this menu and the bar keeps only Run, Run as, More and the assistant toggle.
 */
export function ToolbarMore(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold hover:border-brand"
      >
        More
        <ChevronDown className={clsx('h-3.5 w-3.5 text-muted transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-30 mt-1 max-h-[65vh] w-[min(88vw,280px)] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-card"
          >
            <Section>Run</Section>
            <CheckRow checked={p.sandbox} onChange={p.onSandbox} icon={<Undo2 className="h-3.5 w-3.5 text-warn" />} label="Sandbox (BEGIN / ROLLBACK)" />
            <Row onClick={pick(p.onCompare)} disabled={p.busy} icon={<Users className="h-3.5 w-3.5 text-accent" />} label="3× Compare" />
            <Row onClick={pick(p.onRlsMatrix)} disabled={p.busy} icon={<ShieldCheck className="h-3.5 w-3.5 text-warn" />} label="RLS Matrix" />
            <div className="px-2 py-1.5">{p.share}</div>

            <Section>Assistant</Section>
            {p.aiEnabled ? (
              <>
                <CheckRow checked={p.aiComplete} onChange={p.onAiComplete} icon={<Wand2 className="h-3.5 w-3.5 text-accent" />} label="AI autocomplete" />
                <Row onClick={pick(p.onExplain)} icon={<MessageSquareText className="h-3.5 w-3.5 text-accent" />} label="Explain this SQL" />
                {p.onExplainPlan && <Row onClick={pick(p.onExplainPlan)} icon={<MessageSquareText className="h-3.5 w-3.5 text-accent" />} label="Explain plan" />}
                <Row onClick={pick(p.onReview)} icon={<ShieldCheck className="h-3.5 w-3.5 text-good" />} label="Security review" />
              </>
            ) : (
              <p className="px-2 py-1.5 text-[11px] leading-snug text-muted">AI off · set ANTHROPIC_API_KEY in .env.local</p>
            )}

            <Section>Snippets</Section>
            {p.snippets.map((s) => (
              <Row key={s.label} onClick={pick(() => p.onSnippet(s.sql))} icon={<Check className="h-3.5 w-3.5 text-muted opacity-0" />} label={s.label} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted">{children}</div>;
}

function Row({ onClick, icon, label, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-surface-2 disabled:opacity-50"
    >
      {icon}
      <span className="flex-1">{label}</span>
    </button>
  );
}

function CheckRow({ checked, onChange, icon, label }: { checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string }) {
  return (
    <label className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-surface-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-brand" />
      {icon}
      <span className="flex-1">{label}</span>
    </label>
  );
}
