'use client';

import { useEffect, useState } from 'react';
import { loadFunctions, loadRoles, loadTables, type FunctionInfo, type RoleInfo, type TableInfo } from './introspect';
import { useDbStore } from './store';

export type Schema = { tables: TableInfo[]; functions: FunctionInfo[]; roles: RoleInfo[] };

/** Live catalog of the active database; refetches whenever SQL runs or the mode changes. */
export function useSchema() {
  const revision = useDbStore((s) => s.revision);
  const mode = useDbStore((s) => s.mode);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Sequential: the browser database runs one query at a time anyway.
    (async () => {
      try {
        const tables = await loadTables();
        const functions = await loadFunctions();
        const roles = await loadRoles();
        if (alive) {
          setSchema({ tables, functions, roles });
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [revision, mode]);

  return { schema, error };
}

/** Compact text description of the schema for AI prompts. */
export function describeSchema(schema: Schema | null) {
  if (!schema) return '';
  const tables = schema.tables.map((t) => {
    const cols = t.columns.map((c) => `${c.name} ${c.type}${c.isPk ? ' pk' : ''}`).join(', ');
    const rls = t.rlsEnabled ? ` [RLS on${t.policies.length ? `; policies: ${t.policies.map((p) => `${p.name} ${p.command} using(${p.using ?? ''}) check(${p.check ?? ''})`).join(' | ')}` : ''}]` : '';
    const trg = t.triggers.length ? ` [triggers: ${t.triggers.map((x) => `${x.name} ${x.timing} ${x.events} → ${x.fn}`).join(', ')}]` : '';
    return `${t.schema}.${t.name}(${cols})${rls}${trg}`;
  });
  const fns = schema.functions.map((f) => `${f.schema}.${f.name}(${f.args}) → ${f.returns} ${f.language}${f.security === 'definer' ? ' SECURITY DEFINER' : ''}`);
  return [...tables, ...fns].join('\n');
}
