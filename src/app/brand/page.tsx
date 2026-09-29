'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import { CONCEPTS } from '@/components/brand/LogoConcepts';
import { Segmented } from '@/components/docs/Callout';

type Bg = 'light' | 'dark' | 'brand';
const BG: Record<Bg, string> = { light: '#ffffff', dark: '#0f1622', brand: '#eaf4ff' };

/** Pick-a-logo gallery: all concepts animate live side by side. */
export default function BrandPage() {
  const [bg, setBg] = useState<Bg>('light');
  const [replay, setReplay] = useState(0);

  return (
    <main className="w-full px-4 py-8 sm:px-8 xl:px-12">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Logo concepts</h1>
          <p className="mt-1 text-sm text-muted">Ten animated marks for loaders, splash, slides and favicon. Pick a number.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented value={bg} onChange={setBg} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'brand', label: 'Tint' }]} />
          <button onClick={() => setReplay((r) => r + 1)} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
            <RotateCcw className="h-3.5 w-3.5" /> Restart all
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {CONCEPTS.map(({ id, name, Component, uses, idea }) => (
          <article key={id} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
            <div className={clsx('relative grid h-64 place-items-center')} style={{ background: BG[bg] }}>
              <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-brand font-display text-sm font-extrabold text-on-brand">{id}</span>
              {id === 1 && <span className="absolute right-3 top-3 rounded-full bg-good px-2.5 py-1 text-[11px] font-bold text-white">Selected</span>}
              <Component key={replay} size={150} />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="font-display text-lg font-bold">{name}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{idea}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {uses.map((u) => (
                  <span key={u} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">{u}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
