import { describe, expect, it } from 'vitest';
import { fmt } from './fmt';

describe('fmt', () => {
  it('fills a named placeholder', () => {
    expect(fmt('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  it('fills multiple named placeholders', () => {
    expect(fmt('{rows} rows · {ms} ms', { rows: 42, ms: 3.7 })).toBe('42 rows · 3.7 ms');
  });

  it('leaves an unknown placeholder as-is', () => {
    expect(fmt('Keys erased: {count}.', { n: 5 })).toBe('Keys erased: {count}.');
  });

  it('handles a placeholder used twice', () => {
    expect(fmt('{x} + {x} = {x}', { x: 'me' })).toBe('me + me = me');
  });

  it('accepts zero as a value', () => {
    expect(fmt('count: {n}', { n: 0 })).toBe('count: 0');
  });

  it('converts numbers to strings', () => {
    expect(fmt('page {page}', { page: 1 })).toBe('page 1');
  });
});
