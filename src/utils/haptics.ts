import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper over expo-haptics. Feedback is decorative, so every call is
 * fire-and-forget and swallows errors: a device with no Taptic Engine, Low
 * Power Mode, or a browser without the Vibration API must never break a tap.
 */

const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn: () => Promise<void>): void {
  if (!SUPPORTED) return;
  fn().catch(() => {
    /* haptics are best-effort */
  });
}

/** Light tick for ordinary button taps. */
export function tap(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Signals a changed selection (player chips, language pills). */
export function selection(): void {
  run(() => Haptics.selectionAsync());
}

/**
 * Scoring feedback, weighted by how big the swing is so a +25 lands harder
 * than a +1. Negative deltas use the softer style to read as "taking away".
 */
export function score(delta: number): void {
  const magnitude = Math.abs(delta);
  if (delta < 0) {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
    return;
  }
  const style =
    magnitude >= 20
      ? Haptics.ImpactFeedbackStyle.Heavy
      : magnitude >= 5
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  run(() => Haptics.impactAsync(style));
}

/** Confirmation for completed actions (game started, points applied). */
export function success(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Used when an action is blocked, e.g. hitting the free player limit. */
export function warning(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Rising three-beat flourish for the podium. Returns a cancel function. */
export function celebrate(): () => void {
  if (!SUPPORTED) return () => {};
  const timers: ReturnType<typeof setTimeout>[] = [];
  const beats: [number, Haptics.ImpactFeedbackStyle][] = [
    [0, Haptics.ImpactFeedbackStyle.Light],
    [120, Haptics.ImpactFeedbackStyle.Medium],
    [260, Haptics.ImpactFeedbackStyle.Heavy],
  ];
  for (const [delay, style] of beats) {
    timers.push(setTimeout(() => run(() => Haptics.impactAsync(style)), delay));
  }
  timers.push(setTimeout(() => success(), 430));
  return () => timers.forEach(clearTimeout);
}
