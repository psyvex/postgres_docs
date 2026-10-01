'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye } from 'lucide-react';

/** A node in EXPLAIN (FORMAT JSON) output. Fields match Postgres's JSON keys exactly. */
interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Alias'?: string;
  'Index Name'?: string;
  'Parent Relationship'?: string;
  'Startup Cost': number;
  'Total Cost': number;
  'Plan Rows': number;
  'Plan Width': number;
  'Filter'?: string;
  'Join Type'?: string;
  'Plans'?: PlanNode[];
  // Present with ANALYZE
  'Actual Total Time'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
}

/** The top-level array EXPLAIN (FORMAT JSON) returns: [{ Plan: { ... } }] */
export type PlanEntry = { Plan: PlanNode };

/** True when a StatementResult's last column is 'QUERY PLAN' and rows[0] carries a plan array. */
export function isPlanResult(columns: string[], rows: Record<string, unknown>[]): boolean {
  if (columns.length !== 1 || columns[0] !== 'QUERY PLAN') return false;
  const cell = rows[0]?.['QUERY PLAN'];
  return Array.isArray(cell) && (cell as PlanEntry[])[0]?.Plan?.['Node Type'] != null;
}

/** Flattens the plan tree into a DFS list of { depth, node } pairs. */
function flatten(node: PlanNode, depth = 0): { depth: number; node: PlanNode }[] {
  const result: { depth: number; node: PlanNode }[] = [{ depth, node }];
  for (const child of node.Plans ?? []) {
    result.push(...flatten(child, depth + 1));
  }
  return result;
}

/** Map node type → a tone class prefix. */
const TONE: Record<string, 'bad' | 'good' | 'accent' | 'brand' | 'warn' | 'muted'> = {
  'Seq Scan': 'bad',
  'Index Scan': 'good',
  'Index Only Scan': 'good',
  'Bitmap Index Scan': 'good',
  'Bitmap Heap Scan': 'accent',
  'Bitmap And Scan': 'accent',
  'Bitmap Or Scan': 'accent',
  'Sort': 'brand',
  'Aggregate': 'brand',
  'Group Aggregate': 'brand',
  'Hash Aggregate': 'brand',
  'Limit': 'brand',
  'Result': 'brand',
  'Unique': 'brand',
  'Materialize': 'brand',
  'WindowAgg': 'brand',
  'Nested Loop': 'warn',
  'Hash Join': 'warn',
  'Merge Join': 'warn',
  'Gather': 'muted',
  'Gather Merge': 'muted',
  'Append': 'muted',
  'Merge Append': 'muted',
};

function toneOf(nodeType: string): 'bad' | 'good' | 'accent' | 'brand' | 'warn' | 'muted' {
  return TONE[nodeType] ?? 'muted';
}

const BADGE: Record<string, string> = {
  bad:    'bg-bad/15 text-bad',
  good:   'bg-good/15 text-good',
  accent: 'bg-accent/15 text-accent',
  brand:  'bg-brand/15 text-brand',
  warn:   'bg-warn/15 text-warn',
  muted:  'bg-surface-2 text-muted',
};

function costPct(cost: number, root: number): number {
  if (root <= 0) return 100;
  return Math.min(100, Math.round((cost / root) * 100));
}

// ── PlanTree ──────────────────────────────────────────────────────────────────

type Props = { plan: PlanEntry[] };

export function PlanTree({ plan }: Props) {
  const root = plan[0]?.Plan;
  if (!root) return null;
  const rows = flatten(root);
  const rootCost = root['Total Cost'] || 1;
  const rootTime = root['Actual Total Time'];

  return (
    <div dir="ltr" className="overflow-auto rounded-xl border border-line bg-surface text-[13px]">
      <div className="border-b border-line bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-muted">
        <span>plan · {rows.length} node{rows.length === 1 ? '' : 's'}</span>
        <span className="ml-3 font-mono">cost=0..{rootCost.toFixed(2)}</span>
        {rootTime != null && <span className="ml-2 font-mono">actual={rootTime.toFixed(2)} ms</span>}
      </div>
      <ul>
        {rows.map(({ depth, node }, i) => {
          const tone = toneOf(node['Node Type']);
          const pct = costPct(node['Total Cost'], rootCost);
          const label =
            node['Relation Name'] ??
            node['Index Name'] ??
            (node['Join Type'] ? `${node['Join Type']} ${node['Node Type']}` : node['Node Type']);
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.04 }}
              className="border-b border-line/50 last:border-0"
              style={{ paddingLeft: depth * 20 + 12 }}
            >
              <div className="flex items-center gap-2 py-1.5 pr-3">
                {/* cost bar */}
                <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2" title={`${node['Total Cost'].toFixed(2)} of ${rootCost.toFixed(2)}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, delay: Math.min(i, 10) * 0.04 }}
                    className={`h-full rounded-full ${BADGE[tone].split(' ')[0]}`}
                  />
                </div>
                {/* node type badge */}
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${BADGE[tone]}`}>
                  {node['Node Type']}
                </span>
                {/* relation / join type */}
                {label !== node['Node Type'] && (
                  <span className="shrink-0 truncate font-mono text-xs text-muted">on {label}</span>
                )}
                {/* filter */}
                {node['Filter'] && (
                  <span className="min-w-0 truncate font-mono text-[11px] text-warn" title={node['Filter']}>
                    Filter: {node['Filter']}
                  </span>
                )}
                {/* cost + rows */}
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">
                  cost={node['Startup Cost'].toFixed(2)}..{node['Total Cost'].toFixed(2)} rows={node['Plan Rows']}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

// ── PlanToggle: wraps a ResultTable with a Visual | Text switch ───────────────

type ToggleProps = {
  plan: PlanEntry[];
  /** The original raw table to show in Text mode. */
  raw: React.ReactNode;
};

export function PlanToggle({ plan, raw }: ToggleProps) {
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted">EXPLAIN</span>
        <div className="flex rounded-lg border border-line bg-surface text-[11px] font-semibold">
          <button
            onClick={() => setMode('visual')}
            className={`flex items-center gap-1 rounded-l-lg px-2 py-1 transition ${mode === 'visual' ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
          >
            <Eye className="h-3 w-3" /> Visual
          </button>
          <button
            onClick={() => setMode('text')}
            className={`rounded-r-lg px-2 py-1 transition ${mode === 'text' ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
          >
            Text
          </button>
        </div>
      </div>
      {mode === 'visual' ? <PlanTree plan={plan} /> : raw}
    </div>
  );
}
