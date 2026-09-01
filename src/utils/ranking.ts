import { Player, WinCondition } from '../types';

export interface RankedPlayer {
  player: Player;
  /** 1-based place. Tied players share a place, and the next place skips. */
  rank: number;
  /** True when at least one other player finished on the same score. */
  tied: boolean;
}

/**
 * Orders players best-first for the given win condition using standard
 * competition ranking (1, 2, 2, 4), so a shared second place is shown as such
 * rather than silently promoting one of them.
 */
export function rankPlayers(
  players: Player[],
  winCondition: WinCondition
): RankedPlayer[] {
  const sorted = [...players].sort((a, b) =>
    winCondition === 'highest' ? b.score - a.score : a.score - b.score
  );

  const ranked: RankedPlayer[] = [];
  let currentRank = 1;

  sorted.forEach((player, index) => {
    if (index > 0 && player.score !== sorted[index - 1].score) {
      // Skip the places consumed by everyone tied above this player.
      currentRank = index + 1;
    }
    ranked.push({ player, rank: currentRank, tied: false });
  });

  const countByRank = new Map<number, number>();
  for (const entry of ranked) {
    countByRank.set(entry.rank, (countByRank.get(entry.rank) ?? 0) + 1);
  }
  for (const entry of ranked) {
    entry.tied = (countByRank.get(entry.rank) ?? 0) > 1;
  }

  return ranked;
}

/** The outright winner, or null when the top place is shared. */
export function getWinner(
  players: Player[],
  winCondition: WinCondition
): Player | null {
  const [top] = rankPlayers(players, winCondition);
  if (!top || top.tied) return null;
  return top.player;
}
