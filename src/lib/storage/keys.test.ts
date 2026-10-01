import { describe, expect, it } from 'vitest';
import { describeKey, formatBytes } from './keys';

describe('describeKey', () => {
  it('returns known info for a listed key', () => {
    const info = describeKey('postgres-lab:ai-cache');
    expect(info.label).toBe('AI answer cache');
    expect(info.group).toBe('sql');
    expect(info.private).toBe(true);
  });

  it('returns known info for the UI language key', () => {
    const info = describeKey('postgres-lab:ui-lang');
    expect(info.label).toBe('Interface language');
    expect(info.group).toBe('appearance');
  });

  it('returns a fallback for an unknown key', () => {
    const info = describeKey('postgres-lab:unknown-thing');
    expect(info.label).toBe('unknown-thing');
    expect(info.group).toBe('other');
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 kB');
    expect(formatBytes(2048)).toBe('2.0 kB');
    expect(formatBytes(1536)).toBe('1.5 kB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });
});
