'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { highlightSql } from '@/lib/sql/highlight';

/** One file in the project tree. */
export type ProjectFile = {
  /** Unique path, e.g. "src/db/pool.ts". Used as the selected-key. */
  path: string;
  /** Display label shown in the tree. */
  label: string;
  /** Language id for colouring. */
  lang: 'ts' | 'tsx' | 'py' | 'sql' | 'yaml' | 'json' | 'toml' | 'sh' | 'sqlts';
  /** File content. */
  content: string;
};

/** A folder or file node in the tree. */
type TreeNode = {
  name: string;
  children?: TreeNode[];
  file?: ProjectFile;
};

const LANG_COLORS: Record<ProjectFile['lang'], string> = {
  ts: 'bg-blue-400',
  tsx: 'bg-blue-400',
  py: 'bg-yellow-400',
  sql: 'bg-emerald-400',
  sqlts: 'bg-emerald-400',
  yaml: 'bg-orange-400',
  json: 'bg-orange-400',
  toml: 'bg-orange-400',
  sh: 'bg-slate-400',
};

/**
 * Split a filename for the tree: stem rendered normally, real extension rendered
 * muted. Derived from the actual name (not the `lang` prop) so the badge never
 * lies — e.g. `.env.example` is a dotfile with no separable extension, and a
 * `lang: 'sqlts'` file is still named `.ts` on disk.
 */
function splitName(name: string): { stem: string; suffix: string } {
  if (name.startsWith('.')) return { stem: name, suffix: '' };
  const i = name.lastIndexOf('.');
  return i < 0 ? { stem: name, suffix: '' } : { stem: name.slice(0, i), suffix: name.slice(i) };
}

/** Parse a flat list of files into a nested tree. */
function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split('/');
    let siblings = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let folder = siblings.find((n) => n.name === parts[i] && !!n.children);
      if (!folder) {
        folder = { name: parts[i], children: [] };
        siblings.push(folder);
      }
      siblings = folder.children!;
    }
    siblings.push({ name: parts[parts.length - 1], file });
  }
  return root;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.children && !b.children) return -1;
    if (!a.children && b.children) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Left accent bar on a highlighted line. */
function HighlightBar({ n }: { n: number }) {
  return (
    <div
      className="absolute -left-3 top-0 h-full w-0.5 rounded-full bg-brand"
      title={`Line ${n + 1}`}
    />
  );
}

function CodeBlock({
  content,
  lang,
  highlight: hl,
}: {
  content: string;
  lang: ProjectFile['lang'];
  highlight?: readonly [number, number];
}) {
  const lines = content.split('\n');
  const [start, end] = hl ?? [-1, -1];

  if (lang === 'sql' || lang === 'sqlts') {
    // SQL: use the existing highlighter.
    return (
      <div className="overflow-x-auto rounded-xl bg-code-bg">
        <pre className="font-mono text-[12.5px] leading-relaxed">
          {lines.map((line, i) => {
            const inRange = i >= start && i <= end;
            return (
              <div key={i} className={clsx('relative px-4 py-0.5', inRange && 'bg-brand/10')}>
                {inRange && <HighlightBar n={i} />}
                <span dangerouslySetInnerHTML={{ __html: highlightSql(line) || '&nbsp;' }} />
              </div>
            );
          })}
        </pre>
      </div>
    );
  }

  // Generic token colouring for TypeScript / Python. Not a full parser —
  // sufficient for the lesson-readable excerpts this component shows.
  //
  // One pass, one combined alternation, one replacer. Chaining separate
  // regexes corrupts the output: every pass re-scans the `<span class="…">`
  // markup the previous pass injected — and `class` is itself a keyword —
  // so injected tags get rewritten mid-flight and leak as literal text.
  // Earlier alternatives win, so a keyword inside a string stays a string.
  function tokenise(src: string): string {
    const escaped = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(
      /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`)|\b(\d[\d_]*(?:\.\d+)?)\b|\b(import|export|from|const|let|var|function|class|extends|implements|interface|enum|type|readonly|declare|abstract|private|protected|public|static|module|namespace|requirenew|this|super|async|await|yield|return|if|else|for|while|of|in|as|default|try|catch|finally|throw|void|get|set|null|undefined|true|false|def|elif|except|global|lambda|nonlocal|not|or|and|pass|raise|with|is|assert|break|continue|del)\b/g,
      (match, comment, str, num, kw) => {
        if (comment) return `<span class="text-code-muted italic">${comment}</span>`;
        if (str) return `<span class="text-code-string">${str}</span>`;
        if (num) return `<span class="text-code-number">${num}</span>`;
        if (kw) return `<span class="text-code-keyword font-semibold">${kw}</span>`;
        return match;
      },
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-code-bg">
      <pre className="font-mono text-[12.5px] leading-relaxed">
        {lines.map((line, i) => {
          const inRange = i >= start && i <= end;
          return (
            <div key={i} className={clsx('relative px-4 py-0.5', inRange && 'bg-brand/10')}>
              {inRange && <HighlightBar n={i} />}
              <span dangerouslySetInnerHTML={{ __html: tokenise(line) || '&nbsp;' }} />
            </div>
          );
        })}
      </pre>
    </div>
  );
}

/** One row in the file tree. */
function TreeRow({
  node,
  depth,
  prefix,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  /** Path of the parent folder, so a row can tell whether it holds the open file. */
  prefix: string;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const path = prefix ? `${prefix}/${node.name}` : node.name;
  // Top-level folders start open, and so does every folder holding the file
  // the lesson asked to show first — otherwise `initialSelected` points at a
  // file the reader cannot see without clicking through collapsed folders.
  const [open, setOpen] = useState(
    () => depth === 0 || (!!selected && selected.startsWith(`${path}/`)),
  );
  const isDir = !!node.children;

  return (
    <li>
      <div
        className={clsx(
          'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs',
          'hover:bg-surface-2',
          selected === node.file?.path && 'bg-brand/10 text-brand font-semibold',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDir) setOpen((o) => !o);
          else if (node.file) onSelect(node.file.path);
        }}
        role="treeitem"
        aria-selected={!isDir && selected === node.file?.path}
        aria-expanded={isDir ? open : undefined}
      >
        {isDir ? (
          <>
            <ChevronRight
              className={clsx('h-3 w-3 shrink-0 text-muted transition-transform', open && 'rotate-90')}
            />
            {open ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
            <span className="truncate text-muted">{node.name}</span>
          </>
        ) : (
          <>
            <span
              className={clsx('h-2 w-2 shrink-0 rounded-full', LANG_COLORS[node.file!.lang])}
              title={node.file!.lang}
            />
            <span className="truncate">{splitName(node.name).stem}</span>
            {splitName(node.name).suffix && (
              <span className="shrink-0 font-mono text-[10px] text-muted">{splitName(node.name).suffix}</span>
            )}
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {isDir && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ul role="group">
              {sortTree(node.children!).map((child, i) => (
                <TreeRow
                  key={i}
                  node={child}
                  depth={depth + 1}
                  prefix={path}
                  selected={selected}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function ProjectFiles({
  files,
  initialSelected,
  title,
}: {
  /** Flat list of files. */
  files: ProjectFile[];
  /** Path of the initially selected file. */
  initialSelected?: string;
  /** Optional heading above the whole component. */
  title?: string;
}) {
  const tree = buildTree(files);
  const [selected, setSelected] = useState<string | null>(
    initialSelected ?? files[0]?.path ?? null,
  );
  const selectedFile = files.find((f) => f.path === selected);

  return (
    <div
      className="my-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
      dir="ltr"
    >
      {title && (
        <div className="border-b border-line px-4 py-2.5">
          <span className="font-mono text-xs font-semibold text-muted">{title}</span>
        </div>
      )}
      <div className="flex">
        {/* File tree */}
        <div className="w-52 shrink-0 overflow-y-auto border-r border-line bg-surface-2 py-2 text-[12px]">
          <ul role="tree" aria-label={title ?? 'Project files'}>
            {sortTree(tree).map((node, i) => (
              <TreeRow
                key={i}
                node={node}
                depth={0}
                prefix=""
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </ul>
        </div>

        {/* File content */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {selectedFile ? (
            <div className="p-4">
              {/* File path header */}
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={clsx('h-2 w-2 rounded-full', LANG_COLORS[selectedFile.lang])}
                />
                <span className="font-mono text-[11px] text-muted">{selectedFile.path}</span>
              </div>
              {/* Code */}
              <CodeBlock content={selectedFile.content} lang={selectedFile.lang} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-muted">
              Select a file to view its contents.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
