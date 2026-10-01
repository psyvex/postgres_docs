'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, KeyRound, Shield, Table2, Users, Workflow, Zap } from 'lucide-react';
import type { Schema } from '@/lib/db/useSchema';
import { BrandLoader } from '@/components/brand/BrandMark';

type Props = {
  schema: Schema | null;
  error: string | null;
  selected: string | null;
  onSelectTable: (qualified: string) => void;
  onInsert: (text: string) => void;
};

export function Explorer({ schema, error, selected, onSelectTable, onInsert }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ lab: true, functions: true, roles: false });
  const schemas = [...new Set(schema?.tables.map((t) => t.schema) ?? [])];
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div dir="ltr" className="h-full overflow-y-auto p-3 text-sm">
      {error && <div className="mb-2 rounded-lg bg-bad-soft p-2 text-xs text-bad">{error}</div>}
      {!schema && !error && <BrandLoader size={36} label="Loading catalog…" className="py-8 text-xs" />}

      {schemas.map((s) => (
        <Group key={s} label={`schema ${s}`} icon={<Table2 className="h-3.5 w-3.5" />} open={open[s] ?? false} onToggle={() => toggle(s)}>
          {schema!.tables
            .filter((t) => t.schema === s)
            .map((t) => {
              const q = `${t.schema}.${t.name}`;
              return (
                <li key={q}>
                  <button
                    onClick={() => onSelectTable(q)}
                    onDoubleClick={() => onInsert(t.schema === 'lab' ? t.name : q)}
                    title="Click to browse · double-click to insert"
                    className={clsx('flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left font-mono text-xs', selected === q ? 'bg-brand text-on-brand' : 'hover:bg-surface-2')}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="ms-auto flex items-center gap-1">
                      {t.rlsEnabled && <Shield className={clsx('h-3 w-3', selected === q ? 'text-on-brand' : 'text-good')} aria-label="RLS enabled" />}
                      {t.triggers.length > 0 && <Zap className={clsx('h-3 w-3', selected === q ? 'text-on-brand' : 'text-accent')} aria-label="Has triggers" />}
                    </span>
                  </button>
                </li>
              );
            })}
        </Group>
      ))}

      {schema && (
        <>
          <Group label={`functions (${schema.functions.length})`} icon={<Workflow className="h-3.5 w-3.5" />} open={open.functions} onToggle={() => toggle('functions')}>
            {schema.functions.map((f) => (
              <li key={`${f.schema}.${f.name}(${f.args})`}>
                <button onClick={() => onInsert(`${f.name}()`)} title={`${f.kind} ${f.name}(${f.args}) → ${f.returns}`} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left font-mono text-xs hover:bg-surface-2">
                  <span className="truncate">{f.name}</span>
                  {f.security === 'definer' && <span className="ms-auto rounded bg-warn-soft px-1 text-[9px] font-bold text-warn">DEFINER</span>}
                </button>
              </li>
            ))}
          </Group>
          <Group label={`roles (${schema.roles.length})`} icon={<Users className="h-3.5 w-3.5" />} open={open.roles} onToggle={() => toggle('roles')}>
            {schema.roles.map((r) => (
              <li key={r.name} className="flex items-center gap-1.5 px-2 py-1 font-mono text-xs">
                {r.login ? <KeyRound className="h-3 w-3 text-brand" /> : <span className="h-3 w-3" />}
                <span className="truncate">{r.name}</span>
                {r.superuser && <span className="ms-auto rounded bg-bad-soft px-1 text-[9px] font-bold text-bad">SUPER</span>}
                {!r.superuser && r.bypassRls && <span className="ms-auto rounded bg-warn-soft px-1 text-[9px] font-bold text-warn">BYPASS</span>}
              </li>
            ))}
          </Group>
        </>
      )}
    </div>
  );
}

function Group({ label, icon, open, onToggle, children }: { label: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <button onClick={onToggle} className="flex w-full items-center gap-1.5 rounded-lg px-1 py-1 text-[11px] font-bold uppercase tracking-wide text-muted hover:text-text">
        <ChevronRight className={clsx('h-3.5 w-3.5 transition', open && 'rotate-90')} />
        {icon} {label}
      </button>
      {open && <ul className="mt-0.5 space-y-0.5 pl-2">{children}</ul>}
    </div>
  );
}
