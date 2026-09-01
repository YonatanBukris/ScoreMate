import type { Game, GameRules, GameTemplate } from '../types';

/** The scoreboard shows a fixed grid of quick buttons, so the count is fixed. */
export const QUICK_BUTTON_SLOTS = 4;

/** Guards against a fat-fingered target that would end the game instantly. */
export const MAX_TARGET_SCORE = 100000;
export const MAX_ROUNDS = 999;

/** Starting point for a brand new custom game. */
export const DEFAULT_CUSTOM_RULES: GameRules = {
  winCondition: 'highest',
  quickButtons: [1, 5, 10, -1],
};

/** Strips the presentation fields, leaving just the scoring rules. */
export function rulesFromTemplate(template: GameTemplate): GameRules {
  return {
    winCondition: template.winCondition,
    quickButtons: [...template.quickButtons],
    targetScore: template.targetScore,
    maxRounds: template.maxRounds,
  };
}

/** The rules a game was started with, ready to seed a rematch. */
export function rulesFromGame(game: Game): GameRules {
  return {
    winCondition: game.winCondition,
    quickButtons: [...game.quickButtons],
    targetScore: game.targetScore,
    maxRounds: game.maxRounds,
  };
}

/**
 * Rounds completed so far. A round is one scoring entry per player, so the
 * count only ticks over once everyone has been scored again — which is how the
 * limit reads to a player keeping score at the table.
 */
export function roundsCompleted(game: Game): number {
  if (game.players.length === 0) return 0;
  return Math.floor(game.rounds.length / game.players.length);
}

/** Why the game should end on its own, or null while it is still running. */
export type CompletionReason = 'target' | 'rounds';

/**
 * A target score is a limit rather than a goal: reaching it ends the game
 * whichever way the win condition points, so it works both for a race to 100
 * and for Rummy, where hitting 100 knocks you out and the lowest score wins.
 */
export function getCompletionReason(game: Game): CompletionReason | null {
  if (!game.isActive || game.rounds.length === 0) return null;
  if (game.targetScore !== undefined) {
    const reached = game.players.some((p) => Math.abs(p.score) >= Math.abs(game.targetScore!));
    if (reached) return 'target';
  }
  if (game.maxRounds !== undefined && roundsCompleted(game) >= game.maxRounds) {
    return 'rounds';
  }
  return null;
}

/**
 * Parses a user-typed quick button value. Returns null for anything that is
 * not a usable non-zero integer, so the caller can keep the previous value.
 */
export function parseQuickButton(input: string): number | null {
  const parsed = parseInt(input.replace(/[^\d+-]/g, ''), 10);
  if (Number.isNaN(parsed) || parsed === 0) return null;
  return Math.max(-9999, Math.min(9999, parsed));
}

/** Parses an optional positive limit (target score or round cap). */
export function parseLimit(input: string, max: number): number | undefined {
  const parsed = parseInt(input.replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, max);
}
