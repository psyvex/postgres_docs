'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type Heading = { id: string; text: string; level: number };

/** Table of contents built from the rendered lesson headings, with scroll-spy. */
export function OnThisPage() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLHeadingElement>('.prose-lab h2[id], .prose-lab h3[id]'));
    setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent ?? '', level: n.tagName === 'H2' ? 2 : 3 })));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-72px 0px -70% 0px' },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [pathname]);

  if (!headings.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">On this page</div>
      <ul className="space-y-1 border-l border-line text-sm">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={clsx('-ml-px block border-l-2 py-0.5 transition', h.level === 3 ? 'pl-6 text-[13px]' : 'pl-3', active === h.id ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted hover:text-text')}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
