// Runs every runnable <SqlBlock> in each lesson, in order, against a fresh PGlite (PostgreSQL 18)
// using the same persona/session setup as the app. Prints OK / ERROR per block so content
// regressions are caught before a live session. Usage: pnpm verify:lessons [topic-slug]
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../src/', import.meta.url);
const seedSource = readFileSync(new URL('lib/db/seed.ts', root), 'utf8');
const SEED_SQL = seedSource.match(/SEED_SQL = `([\s\S]*?)`;/)[1];

const PERSONAS = {
  owner: {},
  alice: { role: 'app_member', memberId: 1, orgId: 1 },
  bob: { role: 'app_member', memberId: 2, orgId: 1 },
  carol: { role: 'app_member', memberId: 3, orgId: 2 },
  anon: { role: 'app_anon' },
};

const unescape = (s) => s.replace(/\\([\\`$])/g, '$1');
const BLOCK = /<SqlBlock\b([\s\S]*?)sql=\{`([\s\S]*?)`\}([\s\S]*?)\/>/g;

const only = process.argv[2];
const files = readdirSync(new URL('content/topics/', root)).filter((f) => f.endsWith('.mdx') && (!only || f.startsWith(only)));
let failures = 0;

for (const file of files) {
  const mdx = readFileSync(new URL(`content/topics/${file}`, root), 'utf8');
  const db = await PGlite.create();
  await db.exec(SEED_SQL);
  await db.exec('RESET ALL');
  console.log(`\n━━ ${file}`);
  for (const m of mdx.matchAll(BLOCK)) {
    const attrs = m[1] + m[3];
    if (/\bstatic\b/.test(attrs)) continue;
    const title = attrs.match(/title="([^"]*)"/)?.[1] ?? '(untitled)';
    const as = attrs.match(/\bas="([^"]*)"/)?.[1] ?? 'owner';
    const expectsError = /expect="ERROR/.test(attrs);
    const p = PERSONAS[as];
    const prefix = [
      'SET search_path = lab, public',
      p.memberId != null && `SET app.member_id = '${p.memberId}'`,
      p.orgId != null && `SET app.org_id = '${p.orgId}'`,
      p.role && `SET ROLE ${p.role}`,
    ].filter(Boolean);
    try {
      const res = await db.exec(`${prefix.join(';\n')};\n${unescape(m[2])}`);
      const last = res.filter((r) => r.fields.length).at(-1);
      const summary = last ? `${last.rows.length} row(s) ${JSON.stringify(last.rows[0] ?? {}).slice(0, 90)}` : 'done';
      console.log(`${expectsError ? '⚠️  expected error but OK' : '✅'} [${as}] ${title} → ${summary}`);
      if (expectsError) failures++;
    } catch (e) {
      console.log(`${expectsError ? '✅ (expected error)' : '❌'} [${as}] ${title} → ${e.message}`);
      if (!expectsError) failures++;
    } finally {
      await db.exec('RESET ROLE; RESET ALL;');
    }
  }
  await db.close();
}

console.log(failures ? `\n${failures} unexpected result(s)` : '\nAll lesson examples behaved as expected.');
process.exit(failures ? 1 : 0);
