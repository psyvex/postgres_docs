import { describe, expect, it } from 'vitest';
import { searchItems } from './CommandPalette';

const top = (q: string) => searchItems(q).flat[0]?.item;
const titles = (q: string) => searchItems(q).flat.map(({ item }) => item.title);

describe('command palette ranking', () => {
  it('returns every item when the query is empty', () => {
    const { flat } = searchItems('');
    expect(flat.length).toBeGreaterThan(15);
    // Section order is the display order with no query to reorder it.
    expect(searchItems('').groups.map((g) => g.section.id)).toEqual(['lesson', 'snippet', 'table', 'persona', 'page']);
  });

  it('prefers a title match over a lesson tagline that merely contains the words', () => {
    expect(top('tasks')?.title).toBe('tasks');
    expect(top('tasks')?.type).toBe('table');
  });

  it('puts the persona named Carol above a lesson whose tagline fuzzy-matches c-a-r-o-l', () => {
    // Regression: fuzzy matching over long prose used to rank "Roles & Privileges" first,
    // so Enter opened a lesson when the learner had typed a persona name.
    expect(top('carol')?.title).toBe('Carol · Globex owner');
    expect(titles('carol')).toContain('Roles & Privileges'); // still findable, just not first
  });

  it('floats the section with the strongest hit to the top', () => {
    expect(searchItems('audit').groups[0].section.id).toBe('table');
    expect(searchItems('carol').groups[0].section.id).toBe('persona');
    // A lesson titled "Indexes & EXPLAIN" beats the snippet "Find indexes on tasks":
    // a name that starts with the query outranks one that merely contains it.
    expect(searchItems('indexes').groups[0].section.id).toBe('lesson');
  });

  it('ranks a literal run above scattered characters', () => {
    const { flat } = searchItems('polic');
    const scores = flat.map(({ s }) => s);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(flat[0].item.title).toBe('Show RLS policies on tasks');
  });

  it('matches personas by the role they run as, not just their name', () => {
    expect(titles('app_anon')).toContain('Anonymous visitor');
  });

  it('drops items that share no characters with the query', () => {
    expect(searchItems('zzzz').flat).toEqual([]);
  });
});
