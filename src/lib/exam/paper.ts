import type { Difficulty, ExamQuestion, ExamSettings } from './types';

/**
 * Paper generation.
 *
 * Every participant in an exam is dealt a different paper, and a paper is *derived*, never stored:
 * the exam keeps one integer seed, and `(seed, settings)` reproduces the exact question list. Two
 * things depend on that.
 *
 * - A participant who reloads or reconnects gets the same paper back, because the derivation is
 *   reproducible rather than a shuffled array that existed once.
 * - The server can check a claim like "question 7 of my paper was impossible" without trusting the
 *   client, by re-deriving the paper and looking at index 7 itself.
 *
 * Randomness is `mulberry32`, seeded per exam. It is not cryptographic — it only has to be
 * unpredictable to a participant glancing at their neighbour's screen, and predictable to the server.
 */

/** mulberry32: 32-bit state, one multiply and a shift per step. Small, fast, reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over a copy, driven by the seeded generator rather than `Math.random`. */
function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * How many questions of each difficulty a paper of `count` should contain.
 *
 * Difficulty mix matters because scores across different papers must mean the same thing. If one
 * participant draws five hard questions and another five easy ones, the leaderboard is comparing
 * different exams. Fixing the mix by quota — rather than drawing freely and normalising afterwards —
 * means a point is the same size on every paper in the exam.
 */
export function difficultyQuota(count: number, available: Record<Difficulty, number>): Record<Difficulty, number> {
  // One hard, one medium, the rest easy: an exam should reward knowing a little broadly rather than
  // only the deepest material, but must not be trivial either.
  const wantHard = Math.min(available.hard, Math.max(1, Math.round(count * 0.2)));
  const wantMedium = Math.min(available.medium, Math.max(1, Math.round(count * 0.35)));
  const wantEasy = Math.min(available.easy, count - wantHard - wantMedium);

  // A topic with too few easy items must not silently shrink the paper: backfill from what exists.
  const shortfall = count - wantEasy - wantMedium - wantHard;
  if (shortfall <= 0) return { easy: wantEasy, medium: wantMedium, hard: wantHard };
  return {
    easy: wantEasy,
    medium: wantMedium + Math.min(shortfall, available.medium - wantMedium),
    hard: wantHard + Math.max(0, shortfall - Math.min(shortfall, available.medium - wantMedium)),
  };
}

/**
 * Builds one paper. Deterministic in `(questions, settings, seed)`: the same triple always yields the
 * same ordered ids.
 *
 * Ordering is easy → medium → hard, so a participant warms up and a tied score belongs to whoever got
 * the harder questions right.
 *
 * If the eligible pool is smaller than `count`, the paper is simply shorter — the exam is not allowed
 * to repeat a question, and a repeat is worse than a short exam.
 */
export function generatePaper(questions: readonly ExamQuestion[], settings: ExamSettings, seed: number): string[] {
  const eligible = questions.filter(
    (q) =>
      settings.topicSlugs.includes(q.topicSlug) &&
      (settings.difficulty === 'all' || q.difficulty === settings.difficulty),
  );

  const byDifficulty: Record<Difficulty, ExamQuestion[]> = { easy: [], medium: [], hard: [] };
  for (const q of eligible) byDifficulty[q.difficulty].push(q);

  const available = { easy: byDifficulty.easy.length, medium: byDifficulty.medium.length, hard: byDifficulty.hard.length };

  // A pinned difficulty draws from that bucket alone; 'all' splits by quota.
  const quota: Record<Difficulty, number> =
    settings.difficulty === 'all'
      ? difficultyQuota(settings.count, available)
      : { easy: 0, medium: 0, hard: 0, [settings.difficulty]: settings.count };

  const rand = mulberry32(seed);
  const picked: ExamQuestion[] = [];
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    picked.push(...shuffle(byDifficulty[difficulty], rand).slice(0, Math.min(quota[difficulty], available[difficulty])));
  }

  return picked.slice(0, settings.count).map((q) => q.id);
}

/** Ids of questions the settings can actually draw from — what the create form shows as a limit. */
export function eligibleCount(questions: readonly ExamQuestion[], settings: Pick<ExamSettings, 'topicSlugs' | 'difficulty'>): number {
  return questions.filter(
    (q) => settings.topicSlugs.includes(q.topicSlug) && (settings.difficulty === 'all' || q.difficulty === settings.difficulty),
  ).length;
}

/** A fresh paper seed. Deliberately from `crypto`, so two hosts creating exams never collide. */
export function newPaperSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/**
 * Folds a participant id into the exam's seed to get that participant's own paper seed.
 *
 * This is what makes papers random *per participant* without storing anything: the exam keeps one
 * seed, and `seed ⊕ participantId` reproduces any participant's exact question list on demand. The
 * server can therefore answer "was question 9 fair?" by re-deriving that person's paper instead of
 * believing a client's claim, and a participant who reloads gets the same paper back rather than a
 * reshuffle.
 *
 * FNV-1a is used rather than a hash from `crypto` because the requirement is reproducibility across
 * processes and inputs, not secrecy — the seed is not a credential, and the questions are not secret
 * once anyone has seen them.
 */
export function paperSeedFor(examSeed: number, participantId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < participantId.length; i++) {
    h ^= participantId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h ^ examSeed) >>> 0;
}
