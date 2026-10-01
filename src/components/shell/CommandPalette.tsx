'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';
import { topics } from '@/content/registry';
import { PERSONAS as PERSONAS_CANONICAL } from '@/lib/sql/session';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import {
  BookOpen,
  ChevronRight,
  LayoutList,
  Search,
  Settings,
  Sparkles,
  Table2,
  Zap,
} from 'lucide-react';

/** Event the header button fires to open the palette (⌘K works without it). */
export const OPEN_PALETTE_EVENT = 'lab:open-command-palette';

// ── Data ───────────────────────────────────────────────────────────────────────

type LessonItem = { id: string; type: 'lesson'; title: string; tagline: string; slug: string; icon: IconName; isBreak: boolean };
type SnippetItem = { id: string; type: 'snippet'; title: string; sql: string; description: string };
type TableItem = { id: string; type: 'table'; title: string; description: string };
type PersonaItem = { id: string; type: 'persona'; title: string; as: string; role: string; icon: IconName };
type PageItem = { id: string; type: 'page'; title: string; description: string; href: string };

type Item = LessonItem | SnippetItem | TableItem | PersonaItem | PageItem;

const SECTIONS = [
  { id: 'lesson', label: 'Lessons', icon: BookOpen },
  { id: 'snippet', label: 'Snippets', icon: Zap },
  { id: 'table', label: 'Schema', icon: Table2 },
  { id: 'persona', label: 'Personas', icon: LayoutList },
  { id: 'page', label: 'Pages', icon: Settings },
] as const;

// Pages with no other global entry point (the header has no room for them at 320 px).
const PAGES: PageItem[] = [
  { id: 'pg-settings', type: 'page', title: 'Storage & privacy', description: 'List and erase what this browser holds: AI cache, SQL, translations, progress', href: '/settings' },
];

const SNIPPETS: SnippetItem[] = [
  { id: 's1', type: 'snippet', title: 'Count rows per table', sql: "SELECT schemaname, tablename, n_live_tup::int AS rows FROM pg_stat_user_tables WHERE schemaname = 'lab' ORDER BY n_live_tup DESC;", description: 'Live row counts from pg_stat' },
  { id: 's2', type: 'snippet', title: 'List all lab roles', sql: 'SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname LIKE \'app%\' ORDER BY rolname;', description: 'Roles, superuser and BYPASSRLS flags' },
  { id: 's3', type: 'snippet', title: 'Show RLS policies on tasks', sql: "SELECT polname, polcmd, permissive, pg_get_expr(polqual, polrelid) AS using_clause, pg_get_expr(polwithcheck, polrelid) AS with_check FROM pg_policy WHERE polrelid = 'lab.tasks'::regclass ORDER BY polcmd, polname;", description: 'Every policy on tasks with its clauses' },
  { id: 's4', type: 'snippet', title: 'Check session settings', sql: "SELECT name, setting FROM pg_settings WHERE name LIKE 'app.%' OR name IN ('role', 'search_path', 'row_security') ORDER BY name;", description: 'The app.* settings RLS policies read' },
  { id: 's5', type: 'snippet', title: 'Find indexes on tasks', sql: "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'lab' AND tablename = 'tasks';", description: 'Indexes on the tasks table' },
  { id: 's6', type: 'snippet', title: 'Show column privileges', sql: "SELECT grantee, table_name, column_name, privilege_type FROM information_schema.column_privileges WHERE table_schema = 'lab' ORDER BY table_name, column_name;", description: 'Column-level grants' },
];

const TABLES: TableItem[] = [
  { id: 't1', type: 'table', title: 'tasks', description: 'The board: title, status, org_id, assignee' },
  { id: 't2', type: 'table', title: 'organizations', description: 'Tenants: Acme Rockets, Globex Labs' },
  { id: 't3', type: 'table', title: 'members', description: 'Alice, Bob, Carol, Dan. One org each' },
  { id: 't4', type: 'table', title: 'projects', description: 'Projects, each owned by an org' },
  { id: 't5', type: 'table', title: 'audit_log', description: 'Who changed what, when' },
];

// The same personas the playground's "Run as" selector uses.
const PERSONAS: PersonaItem[] = PERSONAS_CANONICAL.map((p) => ({
  id: `p-${p.id}`,
  type: 'persona',
  title: p.label,
  as: p.id,
  role: p.role,
  icon: p.icon,
}));

const ALL_ITEMS: Item[] = [
  ...topics
    .filter((t) => t.status === 'ready' || t.status === 'break')
    .map((t) => ({
      id: `l-${t.slug}`,
      type: 'lesson' as const,
      title: t.title,
      tagline: t.tagline,
      slug: t.slug,
      icon: t.icon as IconName,
      isBreak: t.status === 'break',
    })),
  ...SNIPPETS,
  ...TABLES,
  ...PERSONAS,
  ...PAGES,
];

// ── Filtering ────────────────────────────────────────────────────────────────

function inOrder(hay: string, needle: string): boolean {
  let from = 0;
  for (const ch of needle) {
    const at = hay.indexOf(ch, from);
    if (at < 0) return false;
    from = at + 1;
  }
  return true;
}

/**
 * A name that starts with the query wins, then a name that contains it, then prose that contains it,
 * then scattered characters in that order. Without the tiers, "carol" fuzzy-matched a lesson tagline
 * ("c-an-…-a-…-r-o-l") and beat the persona named Carol, and "tasks" ranked the table behind a snippet
 * that happens to end with the word.
 */
function score(item: Item, q: string): number {
  if (!q) return 1;
  const extra = 'tagline' in item ? item.tagline : 'description' in item ? item.description : `runs as ${item.role}`;
  const needle = q.toLowerCase();
  const title = item.title.toLowerCase();
  const prose = ` ${extra}`.toLowerCase();
  if (title.startsWith(needle)) return 5;
  if (title.includes(needle)) return 4;
  if (prose.includes(needle)) return 3;
  if (inOrder(title, needle)) return 2;
  if (inOrder(prose, needle)) return 1;
  return 0;
}

/**
 * The whole ranking rule, in one pure call: score every item, group it under its section, then float
 * the section holding the strongest hit to the top, so Enter opens what the query names. Typing
 * "carol" has to surface the persona called Carol, not a lesson whose tagline happens to contain the
 * same letters in order. Exported because that contract is worth a test and hard to see in the DOM.
 */
export function searchItems(q: string) {
  const groups = SECTIONS
    .map((section, order) => {
      const items = ALL_ITEMS.map((item) => ({ item, s: score(item, q) }))
        .filter((e) => e.item.type === section.id && e.s > 0)
        .sort((a, b) => b.s - a.s || a.item.title.localeCompare(b.item.title));
      return { section, order, items, best: items[0]?.s ?? 0 };
    })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.best - a.best || a.order - b.order);

  return { groups, flat: groups.flatMap((g) => g.items) };
}

// ── Palette ──────────────────────────────────────────────────────────────────

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // The same dialog presets every other pop-up uses: backdrop fades, panel grows in from 98%.
  const { backdrop: dialogBackdropFade, panel: dialogPanel } = useMotionPresets();

  useEffect(() => {
    // Where the learner was before ⌘K, so closing the palette doesn't drop them at the top of the page.
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  const { groups, flat } = searchItems(q);

  function execute(item: Item) {
    if (item.type === 'lesson') router.push(`/learn/${item.slug}`);
    else if (item.type === 'snippet') router.push(`/playground?sql=${encodeURIComponent(item.sql)}`);
    else if (item.type === 'table') router.push(`/playground?sql=${encodeURIComponent(`SELECT * FROM lab.${item.title} LIMIT 20;`)}`);
    else if (item.type === 'page') router.push(item.href);
    else router.push(`/playground?as=${item.as}`);
    onClose();
  }

  /** Position of each visible row in the flattened list, the arrow-key counter, keyed by item. */
  const rowIndex = new Map(flat.map((e, i) => [e.item.id, i]));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { const hit = flat[active]; if (hit) execute(hit.item); }
    else if (e.key === 'Tab') {
      // aria-modal promises the page behind is unreachable; without this Tab walks straight into it.
      const panel = e.currentTarget;
      const focusables = [...panel.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const here = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (here === first || !panel.contains(here))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (here === last || !panel.contains(here))) { e.preventDefault(); first.focus(); }
    }
  }

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      onClick={onClose}
      {...dialogBackdropFade}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search the lab"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[72vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        {...dialogPanel}
      >
        {/* Search field */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4.5 w-4.5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search lessons, snippets, tables, personas…"
            aria-label="Search"
            role="combobox"
            aria-expanded={true}
            aria-controls="lab-palette-list"
            aria-autocomplete="list"
            aria-activedescendant={flat[active] ? `lab-palette-opt-${flat[active].item.id}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
          <kbd className="shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} id="lab-palette-list" role="listbox" aria-label="Search results" className="min-h-0 flex-1 overflow-y-auto py-2">
          {flat.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">
              Nothing matches &ldquo;{q}&rdquo;
            </p>
          )}
          {groups.map(({ section, items }) => (
            <div key={section.id} role="group" aria-label={section.label}>
              <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-muted">
                <section.icon className="h-3.5 w-3.5" />
                {section.label}
              </p>
              {items.map(({ item }) => {
                const i = rowIndex.get(item.id) ?? -1;
                const isActive = i === active;
                return (
                  <div
                    key={item.id}
                    id={`lab-palette-opt-${item.id}`}
                    data-active={isActive}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setActive(i)}
                    className={`mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${
                      isActive ? 'bg-accent-soft' : ''
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      item.type === 'lesson' ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted'
                    }`}>
                      {item.type === 'snippet'
                        ? <Sparkles className="h-3.5 w-3.5" />
                        : item.type === 'table'
                          ? <Table2 className="h-3.5 w-3.5" />
                          : item.type === 'page'
                            ? <Settings className="h-3.5 w-3.5" />
                            : <Icon name={item.icon} size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-sm font-semibold ${item.type === 'table' ? 'font-mono' : ''} ${isActive ? 'text-accent' : 'text-text'}`}>
                          {item.title}
                        </span>
                        {item.type === 'lesson' && item.isBreak && (
                          <span className="shrink-0 rounded-full border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-warn">Break it</span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-muted">
                        {'tagline' in item
                          ? item.tagline
                          : 'description' in item
                            ? item.description
                            : item.role ? `SET ROLE ${item.role}` : 'superuser (sees everything)'}
                      </span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer legend */}
        <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface-2 px-4 py-2 text-[10.5px] text-muted">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
          <span className="ms-auto">{flat.length} result{flat.length === 1 ? '' : 's'}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Launcher (mounted once in the root layout) ─────────────────────────────────

export function CommandPaletteLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // AnimatePresence, not a bare conditional: the palette's `exit` props only run if the tree that
  // removes it is watching for them, which is what makes closing as designed as opening.
  return (
    <AnimatePresence>
      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}
