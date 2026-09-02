import type { GamePreset, GameRules } from '../types';

/**
 * The free tier keeps a single preset, which is enough to show what the
 * feature is worth; Pro is unlimited. Saving under a name that is already in
 * use replaces that preset, so the one free slot stays editable.
 */
export const FREE_PRESET_LIMIT = 1;

/** Keeps a pasted essay out of storage and out of the preset cards. */
export const PRESET_NAME_MAX_LENGTH = 28;

/** Trims, collapses whitespace and caps a typed name. Empty means unusable. */
export function normalizePresetName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, PRESET_NAME_MAX_LENGTH);
}

/** Case-insensitive lookup, so "yaniv" and "Yaniv" are the same preset. */
export function findPresetByName(presets: GamePreset[], name: string): GamePreset | null {
  const needle = normalizePresetName(name).toLowerCase();
  if (!needle) return null;
  return presets.find((p) => p.name.toLowerCase() === needle) ?? null;
}

/** Whether the current tier has room for another preset. */
export function canSavePreset(presets: GamePreset[], isPro: boolean): boolean {
  return isPro || presets.length < FREE_PRESET_LIMIT;
}

/** The scoring half of a preset, ready to start a game with. */
export function rulesFromPreset(preset: GamePreset): GameRules {
  return {
    winCondition: preset.winCondition,
    quickButtons: [...preset.quickButtons],
    targetScore: preset.targetScore,
    maxRounds: preset.maxRounds,
  };
}

/** "+1  +5  +10  -1" — the quick buttons as a one-line summary. */
export function formatQuickButtons(quickButtons: number[]): string {
  return quickButtons.map((delta) => (delta > 0 ? `+${delta}` : `${delta}`)).join('  ');
}
