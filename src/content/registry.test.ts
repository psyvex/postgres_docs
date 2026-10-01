import { describe, expect, it } from 'vitest';
import { readyTopics, topics } from './registry';
import { loadedSlugs } from './load';

describe('topic registry', () => {
  it('gives every slug a unique key', () => {
    const slugs = topics.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ships a lesson for every topic the app will route to', async () => {
    // The import map in load.ts is hand-maintained, so a topic can be `ready` in the registry,
    // get prerendered by generateStaticParams, and still build as a 404. This is the guard.
    const missing = readyTopics.filter((t) => !loadedSlugs.includes(t.slug)).map((t) => t.slug);
    expect(missing).toEqual([]);
  });

  it('routes exactly the lessons it has content for, in both directions', () => {
    // One direction is the old 404 guard: `ready` in the registry, prerendered by
    // generateStaticParams, and still a 404 because `load.ts` was never updated.
    // The other direction is the one that shipped silently: `break-rls` had a lesson, an entry in
    // the import map, a route, a ⌘K row and a home-page feature — and the lesson-page sidebar,
    // which asked `status === 'ready'` on its own, labelled it `soon`. A lesson that exists and is
    // not linked is a lesson the reader believes is unwritten.
    const published = readyTopics.map((t) => t.slug).sort();
    expect([...loadedSlugs].sort()).toEqual(published);
  });

  it('files the break-it lab as shipped, not as planned', () => {
    // The specific regression: `status: 'break'` is published. Everything that decides whether to
    // link asks `isPublished`, so `break` and any future status cannot be re-dropped per-surface.
    const t = topics.find((x) => x.slug === 'break-rls');
    expect(t?.status).toBe('break');
    expect(readyTopics.map((x) => x.slug)).toContain('break-rls');
  });

  it('points every topic at an icon the registry knows', async () => {
    const { ICONS } = await import('@/components/icons');
    const unknown = topics.filter((t) => !(t.icon in ICONS)).map((t) => `${t.slug}:${t.icon}`);
    expect(unknown).toEqual([]);
  });

  it('counts graded blocks the same way CI does, not with a second regex', async () => {
    // The old header had its own regex `<SqlBlock(?![^>]*\bstatic\b)[^>]*\bassert=`, which stops
    // at the first `>` inside the SQL, so every block with `WHERE n > 1` or `->>` disappeared from
    // the reader's progress bar — jsonb read 25/40. The page and CI now share graded.mjs.
    // This test reads the actual lesson files and asserts count > 0 for every ready topic.
    const { readFileSync } = await import('node:fs');
    // No `.mjs` extension here: `import('./graded')` resolves types from `graded.d.ts`. The
    // explicit `.mjs` path bypasses the `.d.ts` lookup and fails `tsc` with TS7016. The CI script
    // uses the `.mjs` path because bare `node` cannot import a `.ts`.
    const { countGradedBlocks } = await import('./graded');
    for (const t of readyTopics) {
      const raw = readFileSync(new URL(`./topics/${t.slug}.mdx`, import.meta.url), 'utf8');
      expect(countGradedBlocks(raw), t.slug).toBeGreaterThan(0);
    }
  });
});
