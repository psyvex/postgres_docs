import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal localStorage stub for the Node test environment.
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true });

import { pushHistory, getHistory, getPinned, togglePin, isPinned, clearHistory } from './history';

beforeEach(() => { mockStorage.clear(); });

// ── pushHistory ────────────────────────────────────────────────────────────────

describe('pushHistory', () => {
  it('adds a query to the front', () => {
    pushHistory('SELECT 1');
    expect(getHistory()).toEqual(['SELECT 1']);
  });

  it('most recent first', () => {
    pushHistory('SELECT 1');
    pushHistory('SELECT 2');
    expect(getHistory()).toEqual(['SELECT 2', 'SELECT 1']);
  });

  it('deduplicates: re-running a query moves it to the front, does not duplicate', () => {
    pushHistory('SELECT 1');
    pushHistory('SELECT 2');
    pushHistory('SELECT 1');
    expect(getHistory()).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('trims whitespace before storing', () => {
    pushHistory('  SELECT 1;  ');
    expect(getHistory()).toEqual(['SELECT 1;']);
  });

  it('empty/whitespace-only SQL is not recorded', () => {
    pushHistory('');
    pushHistory('   ');
    expect(getHistory()).toEqual([]);
  });

  it('caps at 50 items', () => {
    for (let i = 0; i < 55; i++) pushHistory(`SELECT ${i}`);
    expect(getHistory()).toHaveLength(50);
    expect(getHistory()[0]).toBe('SELECT 54');
    expect(getHistory()[49]).toBe('SELECT 5');
  });
});

// ── Pinned ─────────────────────────────────────────────────────────────────────

describe('togglePin', () => {
  it('pins a query', () => {
    togglePin('SELECT 1');
    expect(getPinned()).toEqual(['SELECT 1']);
    expect(isPinned('SELECT 1')).toBe(true);
  });

  it('unpinning removes it', () => {
    togglePin('SELECT 1');
    togglePin('SELECT 1');
    expect(getPinned()).toEqual([]);
    expect(isPinned('SELECT 1')).toBe(false);
  });

  it('pinned queries survive a clearHistory()', () => {
    pushHistory('SELECT 1');
    pushHistory('SELECT 2');
    togglePin('SELECT 1');
    clearHistory();
    expect(getHistory()).toEqual([]);
    expect(getPinned()).toEqual(['SELECT 1']);
  });

  it('pins are trimmed and deduplicated', () => {
    togglePin('  SELECT 1  ');
    togglePin('SELECT 1'); // toggle → unpin (text matches after trim)
    expect(getPinned()).toEqual([]);
  });
});

// ── clearHistory ────────────────────────────────────────────────────────────────

describe('clearHistory', () => {
  it('empties the items list', () => {
    pushHistory('SELECT 1');
    clearHistory();
    expect(getHistory()).toEqual([]);
  });

  it('does not throw when storage is empty', () => {
    expect(() => clearHistory()).not.toThrow();
  });
});

// ── Persistence ─────────────────────────────────────────────────────────────────

describe('persistence', () => {
  it('isPinned reads through a fresh call (no in-memory cache)', () => {
    togglePin('SELECT 1');
    expect(isPinned('SELECT 1')).toBe(true);
    expect(isPinned('SELECT 2')).toBe(false);
  });

  it('pushHistory return value matches getHistory()', () => {
    const items = pushHistory('SELECT 1');
    expect(items).toEqual(getHistory());
  });
});

// Suppress unused vi import (vitest hoists it; ESLint flags it if unused).
void vi;
