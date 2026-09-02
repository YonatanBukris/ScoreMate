/**
 * Core domain types for the ScoreMate app.
 */

/** Identifiers for the built-in game templates. */
export type GameModeType = 'standard' | 'skat' | 'rummy' | 'custom';

/** Whether the winner is the player with the highest or lowest score. */
export type WinCondition = 'highest' | 'lowest';

/** A single participant in a game. */
export interface Player {
  id: string;
  name: string;
  score: number;
}

/**
 * A single scoring event. Each tap on a counter (or custom input) records one
 * round entry so the history list can be reconstructed and undone.
 */
export interface Round {
  id: string;
  playerId: string;
  /** Signed change applied to the player's score. */
  delta: number;
  /** Player's running score after this round was applied. */
  resultingScore: number;
  timestamp: number;
}

/**
 * How a game is scored. Templates ship defaults; the custom setup screen lets
 * the user override every field before the game starts.
 */
export interface GameRules {
  winCondition: WinCondition;
  /** Quick-tap increments shown on the scoreboard. */
  quickButtons: number[];
  /** Optional score which, once any player reaches it, ends the game. */
  targetScore?: number;
  /** Optional number of completed rounds after which the game ends. */
  maxRounds?: number;
}

/** A reusable configuration describing how a game is scored. */
export interface GameTemplate extends GameRules {
  id: GameModeType;
  /** i18n key for the display name. */
  nameKey: string;
  /** i18n key for a short description. */
  descriptionKey: string;
}

/**
 * A full game instance, active or completed. The rules are copied onto the
 * game rather than looked up from the template, so a custom game keeps the
 * settings it was started with even after the defaults change.
 */
export interface Game extends GameRules {
  id: string;
  templateId: GameModeType;
  /** i18n key for the template name (kept for display in history). */
  templateNameKey: string;
  players: Player[];
  rounds: Round[];
  createdAt: number;
  /** Last time the game was scored or undone; orders the resume picker. */
  updatedAt: number;
  completedAt?: number;
  /** Active games are paused sessions the player can still resume. */
  isActive: boolean;
}

/**
 * A saved game configuration the user can reload in one tap. Presets carry
 * both the scoring rules and the table they were last played with, so loading
 * one restores the whole setup and not just the numbers.
 */
export interface GamePreset extends GameRules {
  id: string;
  /** User-supplied label, e.g. "Yaniv" or "Friday Rummikub". */
  name: string;
  /** The template the preset was built on, kept for display and history. */
  templateId: GameModeType;
  /** Default player slots, in order. Entries may be blank. */
  playerNames: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Completed games per calendar month, keyed `YYYY-MM` in device local time.
 * The free tier's monthly quota is read from here rather than counted from
 * history, so clearing the history cannot hand out a fresh month's games.
 */
export type MonthlyGameCounts = Record<string, number>;

/** Persisted application state. */
export interface PersistedState {
  games: Game[];
  activeGameId: string | null;
  isPro: boolean;
  /** The player's own name, used to prefill the first slot of a new game. */
  displayName: string;
  /** The user's saved game configurations, newest first. */
  presets: GamePreset[];
  monthlyGameCounts: MonthlyGameCounts;
}
