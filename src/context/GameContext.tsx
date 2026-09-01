import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Game, GameRules, PersistedState, Player, Round, WinCondition } from '../types';
import { getTemplate } from '../types/templates';
import { rulesFromTemplate } from '../utils/rules';
import { loadPersistedState, savePersistedState } from '../utils/persistence';
import { restoreStoredLanguage } from '../i18n';
import {
  configurePurchases,
  isMockMode,
  isProActive,
  setMockProState,
} from '../services/purchaseService';

/** Free tier is capped; unlocking Pro removes the limit. */
export const FREE_PLAYER_LIMIT = 4;

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
    const state: PersistedState = { games, activeGameId, isPro };
    savePersistedState(state);
  }, [games, activeGameId, isPro]);

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
    setGames((prev) =>
      prev.map((game) =>
        game.id === endedId
          ? { ...game, isActive: false, completedAt: Date.now(), updatedAt: Date.now() }
          : game
      )
    );
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

  const value: GameContextValue = {
    ready,
    games,
    activeGame,
    activeGames,
    completedGames,
    isPro,
    createGame,
    resumeGame,
    applyScore,
    undoLastRound,
    endGame,
    deleteGame,
    clearHistory,
    unlockPro,
    resetPro,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
