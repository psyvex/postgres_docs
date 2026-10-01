'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { topics, usedTracks } from '@/content/registry';
import { Icon } from '@/components/icons';
import { useProgress } from '@/lib/learn/progress';

export function TopicSidebar({ active }: { active: string }) {
  const progress = useProgress();

  return (
    <aside className="hidden border-r border-line lg:block">
      <nav className="sticky top-14 max-h-[calc(100vh-3.5rem)] space-y-6 overflow-y-auto px-4 py-8">
        {usedTracks(topics).map((track) => {
          const list = topics.filter((t) => t.track === track);
          if (!list.length) return null;
          return (
            <div key={track}>
              <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-muted">{track}</div>
              <ul className="space-y-0.5">
                {list.map((t) => (
                  <li key={t.slug}>
                    {t.status === 'ready' ? (
                      <Link
                        href={`/learn/${t.slug}`}
                        className={clsx('flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold transition', active === t.slug ? 'bg-brand text-on-brand shadow-card' : 'hover:bg-surface-2')}
                      >
                        <Icon name={t.icon} size={17} /> {t.title}
                        {t.slug in progress.lessons && (
                          <Icon name="ok" size={14} className="ml-auto text-good" />
                        )}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted/70">
                        <Icon name={t.icon} size={17} /> {t.title}
                        <span className="ml-auto rounded bg-surface-2 px-1.5 text-[10px] font-semibold">soon</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
