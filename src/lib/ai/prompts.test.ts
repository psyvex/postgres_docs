import { describe, expect, it } from 'vitest';
import { withAnswerLanguage } from './prompts';

/** The label the server resolves for a code; `null` for anything off the curated list. */
const hi = 'Hindi';

describe('withAnswerLanguage', () => {
  it('leaves the prompt alone when no language was asked for', () => {
    expect(withAnswerLanguage('Q', 'ask', null)).toBe('Q');
  });

  it('leaves it alone for English, which is the prompt language already', () => {
    expect(withAnswerLanguage('Q', 'explain', 'English')).toBe('Q');
  });

  it('applies to every prose task', () => {
    for (const task of ['ask', 'explain', 'fix', 'review', 'explainPlan', 'simplify']) {
      expect(withAnswerLanguage('Q', task, hi)).toContain('Answer in Hindi');
    }
  });

  it('never applies to tasks whose output is code', () => {
    // Ghost text at the cursor and Write-SQL must stay pure SQL; a language line there becomes a
    // comment in the learner's editor.
    expect(withAnswerLanguage('Q', 'complete', hi)).toBe('Q');
    expect(withAnswerLanguage('Q', 'write', hi)).toBe('Q');
    expect(withAnswerLanguage('Q', 'translate', hi)).toBe('Q');
  });

  it('keeps the original prompt byte-identical in front of the instruction', () => {
    const out = withAnswerLanguage('Explain this', 'explain', hi);
    expect(out.startsWith('Explain this\n\n')).toBe(true);
    expect(out).toContain('code fences');
  });
});
