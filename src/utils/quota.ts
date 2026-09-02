import type { Game, MonthlyGameCounts } from '../types';

/**
 * The free tier's monthly game allowance.
 *
 * The quota is deliberately counted over *completed* games and stored as its
 * own tally rather than derived from the history list, so deleting history
 * neither loses games the user has already played nor hands out a fresh five.
 */
export const FREE_MONTHLY_GAME_LIMIT = 5;

/** Older tallies nobody will ever read again are dropped on write. */
const MONTHS_RETAINED = 12;

/** Matches the `YYYY-MM` keys the tally is stored under. */
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The month `when` falls in, as `YYYY-MM` in device local time — the month the
 * user's own calendar shows, which is what "5 games this month" has to mean.
 */
export function monthKey(when: number = Date.now()): string {
  const date = new Date(when);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Games completed in the month containing `when`. */
export function gamesInMonth(counts: MonthlyGameCounts, when: number = Date.now()): number {
  return counts[monthKey(when)] ?? 0;
}

/**
 * Keeps only the most recent months. `YYYY-MM` sorts chronologically as text,
 * so the newest keys are simply the last ones.
 */
export function pruneMonths(counts: MonthlyGameCounts): MonthlyGameCounts {
  const keys = Object.keys(counts).sort();
  if (keys.length <= MONTHS_RETAINED) return counts;
  const pruned: MonthlyGameCounts = {};
  for (const key of keys.slice(-MONTHS_RETAINED)) pruned[key] = counts[key];
  return pruned;
}

/** Adds one to the tally for the month containing `when`. */
export function recordCompletedGame(
  counts: MonthlyGameCounts,
  when: number = Date.now()
): MonthlyGameCounts {
  const key = monthKey(when);
  return pruneMonths({ ...counts, [key]: (counts[key] ?? 0) + 1 });
}

/** Discards keys that are not a month, or not a usable count. */
export function parseMonthlyCounts(raw: Record<string, unknown>): MonthlyGameCounts {
  const counts: MonthlyGameCounts = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!MONTH_KEY_PATTERN.test(key)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    counts[key] = Math.floor(value);
  }
  return pruneMonths(counts);
}

/**
 * Rebuilds the tally from completed games. Only used to migrate state saved
 * before the quota existed; from then on the stored tally is authoritative.
 */
export function deriveMonthlyCounts(games: Game[]): MonthlyGameCounts {
  const counts: MonthlyGameCounts = {};
  for (const game of games) {
    if (game.isActive || game.completedAt === undefined) continue;
    const key = monthKey(game.completedAt);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return pruneMonths(counts);
}

/** Games the user may still complete this month; null when unlimited (Pro). */
export function gamesRemaining(
  counts: MonthlyGameCounts,
  isPro: boolean,
  when: number = Date.now()
): number | null {
  if (isPro) return null;
  return Math.max(0, FREE_MONTHLY_GAME_LIMIT - gamesInMonth(counts, when));
}
