import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Game,
  GamePreset,
  GameRules,
  MonthlyGameCounts,
  PersistedState,
  Player,
  Round,
  WinCondition,
} from '../types';
import { getTemplate } from '../types/templates';
import { rulesFromTemplate } from '../utils/rules';
import {
  DISPLAY_NAME_MAX_LENGTH,
  loadPersistedState,
  savePersistedState,
} from '../utils/persistence';
import {
  canSavePreset,
  findPresetByName,
  normalizePresetName,
} from '../utils/presets';
import {
  FREE_MONTHLY_GAME_LIMIT as MONTHLY_LIMIT,
  gamesInMonth,
  gamesRemaining,
  monthKey,
  recordCompletedGame,
} from '../utils/quota';
import { restoreStoredLanguage } from '../i18n';
import {
  configurePurchases,
  isMockMode,
  isProActive,
  setMockProState,
} from '../services/purchaseService';

/** Free tier is capped; unlocking Pro removes the limit. */
export const FREE_PLAYER_LIMIT = 4;

/** Re-exported so screens have one place to read the free tier's limits. */
export { FREE_MONTHLY_GAME_LIMIT } from '../utils/quota';
export { FREE_PRESET_LIMIT } from '../utils/presets';

/** The setup a preset is being saved from. */
export interface NewPresetInput {
  name: string;
  templateId: string;
  rules: GameRules;
  playerNames: string[];
}

/**
 * Why a save did or did not happen. `limit` is the caller's cue to offer the
 * paywall; `invalid` only happens if an empty name gets through the sheet.
 */
export type SavePresetResult =
  | { status: 'saved'; preset: GamePreset }
  | { status: 'limit' }
  | { status: 'invalid' };

interface NewGameOptions {
  templateId: string;
  playerNames: string[];
  /**
   * Overrides the template defaults. Custom games pass the rules configured in
   * the setup sheet; a rematch passes the rules of the game being replayed.
   */
  rules?: GameRules;
}

interface GameContextValue {
  ready: boolean;
  games: Game[];
  /** The session the game screen is currently showing. */
  activeGame: Game | null;
  /** Every unfinished session, most recently played first. */
  activeGames: Game[];
  completedGames: Game[];
  isPro: boolean;
  /** The player's own name; empty when they have not set one. */
  displayName: string;
  /** Trimmed and length-capped before it is stored. */
  setDisplayName: (name: string) => void;
  /** Lifetime totals over completed games, for the settings screen. */
  stats: { gamesPlayed: number; playersRecorded: number };
  /** Saved game configurations, most recently saved first. */
  presets: GamePreset[];
  /** Games finished in the current calendar month. */
  gamesThisMonth: number;
  /** Games left in the free monthly quota; null when unlimited (Pro). */
  gamesRemainingThisMonth: number | null;
  /** False once a free user has used up this month's quota. */
  canStartGame: boolean;
  /** False once the tier's preset slots are full; replacing still works. */
  canSaveAnotherPreset: boolean;
  /** Saves, or replaces the preset already using that name. */
  savePreset: (input: NewPresetInput) => SavePresetResult;
  deletePreset: (presetId: string) => void;
  createGame: (options: NewGameOptions) => Game;
  /** Points the game screen at an existing paused session. */
  resumeGame: (gameId: string) => void;
  applyScore: (playerId: string, delta: number) => void;
  undoLastRound: () => void;
  /** Archives the active game and returns its id so the podium can show it. */
  endGame: () => string | null;
  /**
   * Removes a game outright. Used both to delete a completed game from history
   * and to discard a session, which must leave no trace in history.
   */
  deleteGame: (gameId: string) => void;
  clearHistory: () => void;
  unlockPro: () => void;
  /** Debug/testing helper: re-locks Pro so paywall triggers can be re-tested. */
  resetPro: () => void;
  /**
   * Debug/testing helper: spends or refunds this month's whole free quota, so
   * the limit can be walked into without playing five games first.
   */
  setMonthlyQuotaFilled: (filled: boolean) => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Determines the winning player given a win condition; null if tied/empty. */
export function getLeader(
  players: Player[],
  winCondition: WinCondition
): Player | null {
  if (players.length === 0) return null;
  const sorted = [...players].sort((a, b) =>
    winCondition === 'highest' ? b.score - a.score : a.score - b.score
  );
  const best = sorted[0];
  const tied = sorted.filter((p) => p.score === best.score).length > 1;
  if (tied) return null;
  // A leader only makes sense once someone has actually scored.
  if (players.every((p) => p.score === 0)) return null;
  return best;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [displayName, setDisplayNameState] = useState('');
  const [presets, setPresets] = useState<GamePreset[]>([]);
  const [monthlyGameCounts, setMonthlyGameCounts] = useState<MonthlyGameCounts>({});

  // Avoid writing back the initial empty state before hydration completes.
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        // Applied before `ready` flips, so screens never flash the wrong language.
        await restoreStoredLanguage();
        await configurePurchases();

        const stored = await loadPersistedState();
        setGames(stored.games);
        setActiveGameId(stored.activeGameId);
        const storedIsPro = stored.isPro;
        setIsPro(storedIsPro);
        setDisplayNameState(stored.displayName);
        setPresets(stored.presets);
        setMonthlyGameCounts(stored.monthlyGameCounts);

        if (isMockMode()) {
          // No store to ask: the persisted flag is the source of truth, which
          // also keeps the debug Lock/Unlock toggle authoritative.
          setMockProState(storedIsPro);
        } else {
          // The store is authoritative, so an expired or refunded subscription
          // correctly revokes access that AsyncStorage still remembers. A null
          // result means the lookup failed, and we keep the persisted value
          // rather than locking out a paying user who happens to be offline.
          const entitled = await isProActive();
          if (entitled !== null) setIsPro(entitled);
        }
      } catch (err) {
        console.warn('Failed to load saved state', err);
      } finally {
        hydrated.current = true;
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const state: PersistedState = {
      games,
      activeGameId,
      isPro,
      displayName,
      presets,
      monthlyGameCounts,
    };
    savePersistedState(state);
  }, [games, activeGameId, isPro, displayName, presets, monthlyGameCounts]);

  const activeGame = useMemo(
    () => games.find((g) => g.id === activeGameId && g.isActive) ?? null,
    [games, activeGameId]
  );

  // Unfinished sessions, newest activity first — the order the resume picker
  // and the home banner both present them in.
  const activeGames = useMemo(
    () => games.filter((g) => g.isActive).sort((a, b) => b.updatedAt - a.updatedAt),
    [games]
  );

  const completedGames = useMemo(
    () =>
      games
        .filter((g) => !g.isActive)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [games]
  );

  /**
   * Lifetime totals shown in settings. Players are counted by distinct name
   * rather than by seat, so the same four friends across ten games read as
   * four players and not forty.
   */
  const stats = useMemo(() => {
    const names = new Set<string>();
    for (const game of completedGames) {
      for (const player of game.players) {
        const name = player.name.trim().toLowerCase();
        if (name) names.add(name);
      }
    }
    return { gamesPlayed: completedGames.length, playersRecorded: names.size };
  }, [completedGames]);

  // Most recently saved first, matching how sessions and history are ordered.
  // Loading a preset does not touch `updatedAt`, so the order a player learns
  // stays put while they use it.
  const sortedPresets = useMemo(
    () => [...presets].sort((a, b) => b.updatedAt - a.updatedAt),
    [presets]
  );

  /**
   * The monthly quota. Read at render from the stored tally, so it is refreshed
   * by any state change; a session left open across a month boundary catches up
   * the next time anything happens rather than at midnight on the 1st.
   */
  const gamesThisMonth = useMemo(() => gamesInMonth(monthlyGameCounts), [monthlyGameCounts]);
  const gamesRemainingThisMonth = useMemo(
    () => gamesRemaining(monthlyGameCounts, isPro),
    [monthlyGameCounts, isPro]
  );
  const canStartGame = gamesRemainingThisMonth === null || gamesRemainingThisMonth > 0;
  const canSaveAnotherPreset = canSavePreset(presets, isPro);

  const setDisplayName = useCallback((name: string) => {
    setDisplayNameState(name.trim().slice(0, DISPLAY_NAME_MAX_LENGTH));
  }, []);

  /**
   * Saving under a name that is already taken replaces that preset rather than
   * adding a second one — that is also how the free tier's single slot gets
   * re-used, so hitting the cap never leaves the user unable to edit it.
   */
  const savePreset = useCallback(
    (input: NewPresetInput): SavePresetResult => {
      const name = normalizePresetName(input.name);
      if (!name) return { status: 'invalid' };

      const existing = findPresetByName(presets, name);
      if (!existing && !canSavePreset(presets, isPro)) return { status: 'limit' };

      const now = Date.now();
      const preset: GamePreset = {
        id: existing?.id ?? makeId('preset'),
        name,
        templateId: getTemplate(input.templateId).id,
        winCondition: input.rules.winCondition,
        quickButtons: [...input.rules.quickButtons],
        targetScore: input.rules.targetScore,
        maxRounds: input.rules.maxRounds,
        playerNames: input.playerNames.map((n) =>
          n.trim().slice(0, DISPLAY_NAME_MAX_LENGTH)
        ),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      setPresets((prev) =>
        existing ? prev.map((p) => (p.id === existing.id ? preset : p)) : [...prev, preset]
      );
      return { status: 'saved', preset };
    },
    [presets, isPro]
  );

  const deletePreset = useCallback((presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  }, []);

  const createGame = useCallback((options: NewGameOptions): Game => {
    const template = getTemplate(options.templateId);
    const rules = options.rules ?? rulesFromTemplate(template);
    const players: Player[] = options.playerNames.map((name, index) => ({
      id: makeId('p'),
      name: name.trim() || `Player ${index + 1}`,
      score: 0,
    }));
    const game: Game = {
      id: makeId('g'),
      templateId: template.id,
      templateNameKey: template.nameKey,
      winCondition: rules.winCondition,
      quickButtons: [...rules.quickButtons],
      targetScore: rules.targetScore,
      maxRounds: rules.maxRounds,
      players,
      rounds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };
    // Any game already in progress stays in progress: it becomes a paused
    // session the player can pick back up from the home screen.
    setGames((prev) => [...prev, game]);
    setActiveGameId(game.id);
    return game;
  }, []);

  const resumeGame = useCallback(
    (gameId: string) => {
      // Guarded so a stale row in the picker cannot point the game screen at a
      // session that has since been discarded or finished.
      if (games.some((g) => g.id === gameId && g.isActive)) setActiveGameId(gameId);
    },
    [games]
  );

  const applyScore = useCallback(
    (playerId: string, delta: number) => {
      if (delta === 0) return;
      setGames((prev) =>
        prev.map((game) => {
          if (game.id !== activeGameId) return game;
          let resultingScore = 0;
          const players = game.players.map((p) => {
            if (p.id !== playerId) return p;
            resultingScore = p.score + delta;
            return { ...p, score: resultingScore };
          });
          const round: Round = {
            id: makeId('r'),
            playerId,
            delta,
            resultingScore,
            timestamp: Date.now(),
          };
          return {
            ...game,
            players,
            rounds: [...game.rounds, round],
            updatedAt: round.timestamp,
          };
        })
      );
    },
    [activeGameId]
  );

  const undoLastRound = useCallback(() => {
    setGames((prev) =>
      prev.map((game) => {
        if (game.id !== activeGameId || game.rounds.length === 0) return game;
        const last = game.rounds[game.rounds.length - 1];
        const players = game.players.map((p) =>
          p.id === last.playerId ? { ...p, score: p.score - last.delta } : p
        );
        return {
          ...game,
          players,
          rounds: game.rounds.slice(0, -1),
          updatedAt: Date.now(),
        };
      })
    );
  }, [activeGameId]);

  const endGame = useCallback((): string | null => {
    const endedId = activeGameId;
    if (!endedId) return null;
    const completedAt = Date.now();
    setGames((prev) =>
      prev.map((game) =>
        game.id === endedId
          ? { ...game, isActive: false, completedAt, updatedAt: completedAt }
          : game
      )
    );
    // The quota counts finished games, and is kept apart from the history list
    // so deleting a game cannot buy another one.
    setMonthlyGameCounts((prev) => recordCompletedGame(prev, completedAt));
    setActiveGameId(null);
    return endedId;
  }, [activeGameId]);

  const deleteGame = useCallback(
    (gameId: string) => {
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      if (gameId === activeGameId) setActiveGameId(null);
    },
    [activeGameId]
  );

  const clearHistory = useCallback(() => {
    setGames((prev) => prev.filter((g) => g.isActive));
  }, []);

  // Mock mode has no store to consult, so the service is kept in step with
  // local state; in live mode the entitlement always comes from RevenueCat.
  const unlockPro = useCallback(() => {
    setIsPro(true);
    if (isMockMode()) setMockProState(true);
  }, []);

  // The persistence effect above mirrors this straight back to AsyncStorage.
  const resetPro = useCallback(() => {
    setIsPro(false);
    if (isMockMode()) setMockProState(false);
  }, []);

  const setMonthlyQuotaFilled = useCallback((filled: boolean) => {
    // A zero is dropped on the next read, which is what makes this a reset.
    setMonthlyGameCounts((prev) => ({ ...prev, [monthKey()]: filled ? MONTHLY_LIMIT : 0 }));
  }, []);

  const value: GameContextValue = {
    ready,
    games,
    activeGame,
    activeGames,
    completedGames,
    isPro,
    displayName,
    setDisplayName,
    stats,
    presets: sortedPresets,
    gamesThisMonth,
    gamesRemainingThisMonth,
    canStartGame,
    canSaveAnotherPreset,
    savePreset,
    deletePreset,
    createGame,
    resumeGame,
    applyScore,
    undoLastRound,
    endGame,
    deleteGame,
    clearHistory,
    unlockPro,
    resetPro,
    setMonthlyQuotaFilled,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
