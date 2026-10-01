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

import { gradeChecks } from '../src/lib/learn/check.mjs';
// The block rule is not duplicated here on purpose: this file, the lesson page and the share card
// all count graded blocks, and when the page kept its own regex it read 25 of `jsonb`'s 40.
import { sqlBlocks, ASSERT_ATTR as ASSERT } from '../src/content/graded.mjs';

const unescape = (s) => s.replace(/\\([\\`$])/g, '$1');

/**
 * PGlite's raw results → the `RunResult` shape the app and the grader speak. Mirrors
 * `toStatements()` in `src/lib/db/local-adapter.ts` exactly, including the per-statement delta:
 * PGlite reports `affectedRows` cumulatively across a multi-statement exec, and a statement that
 * returns no table reports its count there. Without this an `affected: n` check grades 0 in CI while
 * passing in the browser.
 */
const toResult = (res) => {
  let previousAffected = 0;
  return {
    ok: true,
    durationMs: 0,
    results: res.map((r) => {
      const affected = (r.affectedRows ?? 0) - previousAffected;
      previousAffected = r.affectedRows ?? previousAffected;
      return {
        columns: r.fields.map((f) => f.name),
        rows: r.rows,
        rowCount: r.fields.length ? r.rows.length : affected,
      };
    }),
  };
};

const only = process.argv[2];
const files = readdirSync(new URL('content/topics/', root)).filter((f) => f.endsWith('.mdx') && (!only || f.startsWith(only)));
let failures = 0;

for (const file of files) {
  const mdx = readFileSync(new URL(`content/topics/${file}`, root), 'utf8');
  const db = await PGlite.create();
  await db.exec(SEED_SQL);
  await db.exec('RESET ALL');
  console.log(`\n━━ ${file}`);
  for (const block of sqlBlocks(mdx)) {
    if (block.isStatic) continue;
    const { attrs, title, persona: as } = block;
    const expectsError = /expect="ERROR/.test(attrs);
    const p = PERSONAS[as];
    const prefix = [
      'SET search_path = lab, public',
      p.memberId != null && `SET app.member_id = '${p.memberId}'`,
      p.orgId != null && `SET app.org_id = '${p.orgId}'`,
      p.role && `SET ROLE ${p.role}`,
    ].filter(Boolean);

    // The block's `assert` is graded with the same module the browser card uses, so a check that
    // lies about the database fails CI here rather than misleading a learner at 1am.
    const am = attrs.match(ASSERT);
    let checks = null;
    if (am) {
      try {
        checks = new Function(`return ${am[1]}`)();
      } catch (e) {
        console.log(`❌ [${as}] ${title} → assert does not parse: ${e.message}`);
        failures++;
        continue;
      }
    }

    try {
      const res = await db.exec(`${prefix.join(';\n')};\n${unescape(block.sql)}`);
      const last = res.filter((r) => r.fields.length).at(-1);
      const summary = last ? `${last.rows.length} row(s) ${JSON.stringify(last.rows[0] ?? {}).slice(0, 90)}` : 'done';
      const verdict = checks ? gradeChecks(toResult(res), checks, prefix.length) : null;
      const bad = (expectsError ? 1 : 0) + (verdict && !verdict.passed ? 1 : 0);
      failures += bad;
      const mark = bad ? '❌' : '✅';
      console.log(`${mark} [${as}] ${title} → ${summary}${checks ? ` · ${verdict.passed ? `${checks.length} check(s) pass` : `CHECKS FAIL: ${verdict.failures.join(' | ')}`}` : ''}`);
    } catch (e) {
      const verdict = checks ? gradeChecks({ ok: false, error: e.message, durationMs: 0 }, checks, prefix.length) : null;
      const bad = (!expectsError ? 1 : 0) + (verdict && !verdict.passed ? 1 : 0);
      failures += bad;
      console.log(`${bad ? '❌' : '✅'} [${as}] ${title} → ${e.message}${checks ? ` · ${verdict.passed ? `${checks.length} check(s) pass` : `CHECKS FAIL: ${verdict.failures.join(' | ')}`}` : ''}`);
    } finally {
      // Same recovery the app performs (`local-adapter.ts`): a block that opens BEGIN and then fails
      // leaves the session aborted, and every later statement — RESET included — answers 25P02
      // ("current transaction is aborted"), which would take the whole verifier down mid-lesson.
      await db.exec('ROLLBACK; RESET ROLE; RESET ALL;').catch(() => undefined);
    }
  }
  await db.close();
}

console.log(failures ? `\n${failures} unexpected result(s)` : '\nAll lesson examples behaved as expected.');
process.exit(failures ? 1 : 0);
