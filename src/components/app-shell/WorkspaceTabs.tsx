'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { appNavigation, labNavigation } from '@/config/app-shell';

const tabs = [...appNavigation, ...labNavigation];

export function WorkspaceTabs() { const pathname = usePathname(); return <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-3"><div className="flex min-w-max items-center gap-1 py-2">{tabs.map((tab) => <Link key={tab.id} href={tab.href} className={`rounded-md px-3 py-1.5 text-xs transition ${pathname === tab.href ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'}`}>{tab.label}</Link>)}</div></div>; }
