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

  it('points every topic at an icon the registry knows', async () => {
    const { ICONS } = await import('@/components/icons');
    const unknown = topics.filter((t) => !(t.icon in ICONS)).map((t) => `${t.slug}:${t.icon}`);
    expect(unknown).toEqual([]);
  });

  it('gives break-it lessons a challenge count, so the header has a denominator', () => {
    for (const t of topics.filter((x) => x.status === 'break')) {
      expect(t.challengeCount, t.slug).toBeTypeOf('number');
      expect(t.challengeCount).toBeGreaterThan(0);
    }
  });
});
