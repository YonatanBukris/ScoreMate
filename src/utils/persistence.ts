import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Game, PersistedState, Player, Round, WinCondition } from '../types';
import { getTemplate } from '../types/templates';

/**
 * Single source of truth for reading and writing the saved game state.
 *
 * Everything the app remembers between launches lives under two keys: this one
 * for games and the Pro flag, and `scorekeeper/language/v1` for the language
 * override (owned by `src/i18n`, since it has to be applied before the first
 * render). Nothing else is persisted.
 */
export const STORAGE_KEY = 'scorekeeper/state/v1';

export const EMPTY_STATE: PersistedState = {
  games: [],
  activeGameId: null,
  isPro: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function parsePlayer(raw: unknown): Player | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    name: str(raw.name, ''),
    score: num(raw.score, 0),
  };
}

function parseRound(raw: unknown, players: Player[]): Round | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  // A round pointing at a player who is no longer in the game would break both
  // undo and the history list, so it is dropped rather than repaired.
  if (!players.some((p) => p.id === raw.playerId)) return null;
  return {
    id: raw.id,
    playerId: raw.playerId as string,
    delta: num(raw.delta, 0),
    resultingScore: num(raw.resultingScore, 0),
    timestamp: num(raw.timestamp, 0),
  };
}

/**
 * Validates one stored game and fills in fields added by later versions.
 * Returns null for a record too damaged to show, so a single bad entry cannot
 * take the whole library down with it.
 */
export function parseGame(raw: unknown): Game | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;

  const players = Array.isArray(raw.players)
    ? raw.players.map(parsePlayer).filter((p): p is Player => p !== null)
    : [];
  if (players.length === 0) return null;

  const rounds = Array.isArray(raw.rounds)
    ? raw.rounds.map((r) => parseRound(r, players)).filter((r): r is Round => r !== null)
    : [];

  const template = getTemplate(str(raw.templateId, 'standard'));
  const createdAt = num(raw.createdAt, Date.now());
  const winCondition: WinCondition = raw.winCondition === 'lowest' ? 'lowest' : 'highest';
  const quickButtons =
    Array.isArray(raw.quickButtons) && raw.quickButtons.length > 0
      ? raw.quickButtons.map((v) => num(v, 1))
      : [...template.quickButtons];

  return {
    id: raw.id,
    templateId: template.id,
    templateNameKey: str(raw.templateNameKey, template.nameKey),
    winCondition,
    quickButtons,
    targetScore: typeof raw.targetScore === 'number' ? raw.targetScore : undefined,
    maxRounds: typeof raw.maxRounds === 'number' ? raw.maxRounds : undefined,
    players,
    rounds,
    createdAt,
    // Games saved before `updatedAt` existed get the best available stand-in,
    // so the resume picker still orders them sensibly.
    updatedAt: num(
      raw.updatedAt,
      rounds.length > 0 ? rounds[rounds.length - 1].timestamp : num(raw.completedAt, createdAt)
    ),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : undefined,
    isActive: raw.isActive === true,
  };
}

/**
 * Turns whatever is in storage into state the app can trust. Anything
 * unreadable degrades to the empty state rather than throwing on launch.
 */
export function parsePersistedState(raw: string | null): PersistedState {
  if (!raw) return EMPTY_STATE;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('Saved state is not valid JSON; starting fresh', err);
    return EMPTY_STATE;
  }
  if (!isRecord(parsed)) return EMPTY_STATE;

  const games = Array.isArray(parsed.games)
    ? parsed.games.map(parseGame).filter((g): g is Game => g !== null)
    : [];

  // A pointer to a game that was deleted (or has since finished) would strand
  // every other paused session, so it falls back to the newest active game.
  const pointer = typeof parsed.activeGameId === 'string' ? parsed.activeGameId : null;
  const pointerIsUsable = games.some((g) => g.id === pointer && g.isActive);
  const newestActive = games
    .filter((g) => g.isActive)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return {
    games,
    activeGameId: pointerIsUsable ? pointer : (newestActive?.id ?? null),
    isPro: parsed.isPro === true,
  };
}

/** Reads and normalizes the saved state; never rejects. */
export async function loadPersistedState(): Promise<PersistedState> {
  try {
    return parsePersistedState(await AsyncStorage.getItem(STORAGE_KEY));
  } catch (err) {
    console.warn('Failed to load saved state', err);
    return EMPTY_STATE;
  }
}

/** Writes the state back. Failures are logged, never thrown at the UI. */
export async function savePersistedState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to persist state', err);
  }
}
