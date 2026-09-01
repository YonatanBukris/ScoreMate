/** A translation key plus the count to interpolate into it. */
export interface RelativeTime {
  key: string;
  count: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Coarse "how long ago" label, as a key the caller translates. Kept to whole
 * minutes/hours/days: a paused game only needs to be placed in time, and
 * `Intl.RelativeTimeFormat` is not guaranteed on every Hermes build we ship to.
 */
export function relativeTime(timestamp: number, now: number = Date.now()): RelativeTime {
  // Clock changes (or a device that woke up with a corrected time) can put a
  // saved timestamp slightly in the future; treat that as "just now".
  const elapsed = Math.max(0, now - timestamp);

  if (elapsed < MINUTE) return { key: 'time.justNow', count: 0 };
  if (elapsed < HOUR) return { key: 'time.minutesAgo', count: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { key: 'time.hoursAgo', count: Math.floor(elapsed / HOUR) };
  return { key: 'time.daysAgo', count: Math.floor(elapsed / DAY) };
}
