import type { TestRating } from '@tahfeedh/shared';

export type ActivityWindow = '7d' | '30d';

export interface ActivityStatsRaw {
  pagesMemorized: number;
  pagesReviewed: number;
  testsCompleted: number;
  testsPassed: number;
}

export interface ActivityStats extends ActivityStatsRaw {
  passRate: number; // 0..1, NaN-safe (0 when no tests)
}

// ADR 0046 — only one passing rating now (`pass`).
export function isPassingRating(r: TestRating | null | undefined): boolean {
  return r === 'pass';
}

export function summarize({
  pagesMemorized,
  pagesReviewed,
  testsCompleted,
  testsPassed,
}: ActivityStatsRaw): ActivityStats {
  const passRate = testsCompleted > 0 ? testsPassed / testsCompleted : 0;
  return { pagesMemorized, pagesReviewed, testsCompleted, testsPassed, passRate };
}

export function windowDays(w: ActivityWindow): number {
  return w === '7d' ? 7 : 30;
}

export function cutoffIso(w: ActivityWindow, now?: Date): string {
  const base = now ?? new Date();
  const cutoff = new Date(base);
  cutoff.setDate(cutoff.getDate() - windowDays(w));
  return cutoff.toISOString();
}
