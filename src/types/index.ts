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

/** Persisted application state. */
export interface PersistedState {
  games: Game[];
  activeGameId: string | null;
  isPro: boolean;
  /** The player's own name, used to prefill the first slot of a new game. */
  displayName: string;
}
