/**
 * Palace Rank Hierarchy - 后宫品级制度
 *
 * Defines the complete rank structure of the imperial harem,
 * from 答应 (lowest) to 皇后 (highest).
 */

export interface PalaceRank {
  /** Rank level (1 = lowest, 8 = highest) */
  level: number;
  /** Chinese title */
  title: string;
  /** Maximum number of agents allowed at this rank */
  maxSlots: number;
  /** Monthly resource allowance */
  monthlyAllowance: number;
  /** Minimum ELO rating required to hold this rank */
  minElo: number;
}

export const PALACE_RANKS: readonly PalaceRank[] = [
  { level: 1, title: '答应', maxSlots: 999, monthlyAllowance: 10, minElo: 0 },
  { level: 2, title: '常在', maxSlots: 999, monthlyAllowance: 20, minElo: 1000 },
  { level: 3, title: '贵人', maxSlots: 6, monthlyAllowance: 50, minElo: 1100 },
  { level: 4, title: '嫔', maxSlots: 6, monthlyAllowance: 100, minElo: 1200 },
  { level: 5, title: '妃', maxSlots: 4, monthlyAllowance: 200, minElo: 1300 },
  { level: 6, title: '贵妃', maxSlots: 2, monthlyAllowance: 400, minElo: 1400 },
  { level: 7, title: '皇贵妃', maxSlots: 1, monthlyAllowance: 800, minElo: 1500 },
  { level: 8, title: '皇后', maxSlots: 1, monthlyAllowance: 1000, minElo: 1600 },
] as const;

/** Get a rank by its level number */
export function getRankByLevel(level: number): PalaceRank | undefined {
  return PALACE_RANKS.find(r => r.level === level);
}

/** Get a rank by its Chinese title */
export function getRankByTitle(title: string): PalaceRank | undefined {
  return PALACE_RANKS.find(r => r.title === title);
}

/** Get the next higher rank */
export function getNextRank(currentLevel: number): PalaceRank | undefined {
  return PALACE_RANKS.find(r => r.level === currentLevel + 1);
}

/** Get the next lower rank */
export function getPreviousRank(currentLevel: number): PalaceRank | undefined {
  return PALACE_RANKS.find(r => r.level === currentLevel - 1);
}

/** Check if an agent can be promoted to the next rank based on ELO and slot availability */
export function canPromote(currentLevel: number, elo: number): boolean {
  const nextRank = getNextRank(currentLevel);
  if (!nextRank) return false;
  return elo >= nextRank.minElo;
}

/** Check if a rank has reached its maximum number of occupants */
export function isRankFull(level: number, currentOccupants: number): boolean {
  const rank = getRankByLevel(level);
  if (!rank) return true;
  return currentOccupants >= rank.maxSlots;
}
