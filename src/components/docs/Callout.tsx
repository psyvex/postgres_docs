import clsx from 'clsx';
import { Icon, type IconName } from '@/components/icons';

const STYLES = {
  tip: { icon: 'tip', label: 'Tip', cls: 'border-good/30 bg-good-soft', tone: 'text-good' },
  note: { icon: 'note', label: 'Note', cls: 'border-brand/30 bg-brand-soft', tone: 'text-brand' },
  warn: { icon: 'warn', label: 'Careful', cls: 'border-warn/40 bg-warn-soft', tone: 'text-warn' },
  danger: { icon: 'danger', label: 'Security', cls: 'border-bad/30 bg-bad-soft', tone: 'text-bad' },
  fun: { icon: 'postgres', label: 'Analogy', cls: 'border-accent/30 bg-accent-soft', tone: 'text-accent' },
  version: { icon: 'version', label: 'Version note', cls: 'border-accent/30 bg-accent-soft', tone: 'text-accent' },
} as const satisfies Record<string, { icon: IconName; label: string; cls: string; tone: string }>;

export function Callout({ type = 'note', title, children }: { type?: keyof typeof STYLES; title?: string; children: React.ReactNode }) {
  const s = STYLES[type];
  return (
    <aside className={clsx('my-6 rounded-2xl border px-4 py-3 [&>p:first-of-type]:mt-1 [&>p:last-child]:mb-0', s.cls)}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon name={s.icon} size={18} className={s.tone} /> {title ?? s.label}
      </div>
      {children}
    </aside>
  );
}

/** Frame for interactive animations embedded in lessons. */
export function DemoFrame({ title, icon, subtitle, controls, children, footer }: { title: string; icon: IconName; subtitle?: string; controls?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="not-prose my-8 overflow-hidden rounded-3xl border-2 border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-brand shadow-card"><Icon name={icon} size={20} /></span>
        <div className="min-w-0">
          <div className="font-display text-base font-bold leading-tight">{title}</div>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
        {controls && <div className="ml-auto flex flex-wrap items-center gap-2">{controls}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
      {footer && <footer className="border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-muted">{footer}</footer>}
    </section>
  );
}

export function Toggle({ on, onChange, label, tone = 'good' }: { on: boolean; onChange: (v: boolean) => void; label: string; tone?: 'good' | 'bad' | 'brand' }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold" aria-pressed={on}>
      <span className={clsx('relative h-4 w-7 rounded-full transition', on ? (tone === 'bad' ? 'bg-bad' : tone === 'brand' ? 'bg-brand' : 'bg-good') : 'bg-line')}>
        <span className={clsx('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all', on ? 'left-3.5' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition', value === o.value ? 'bg-brand text-on-brand' : 'text-muted hover:text-text')}>
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
