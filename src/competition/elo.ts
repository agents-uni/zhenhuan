/**
 * ELO Rating System - 后宫竞技评分
 *
 * Implements ELO-based competitive ranking for palace agents.
 * Agents gain/lose ELO through task competitions, direct challenges,
 * and performance evaluations.
 */

export interface EloRecord {
  agentId: string;
  rating: number;
  peakRating: number;
  matchCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  streak: number; // positive = win streak, negative = loss streak
  history: EloChange[];
}

export interface EloChange {
  timestamp: string;
  opponent: string;
  oldRating: number;
  newRating: number;
  result: 'win' | 'loss' | 'draw';
  reason: string;
}

export interface MatchResult {
  winner: string;
  loser: string;
  isDraw: boolean;
  reason: string;
  /** Score difference (0-1, higher = more decisive) */
  margin: number;
}

/** Default K-factor for ELO calculation */
const DEFAULT_K = 32;
/** K-factor for new agents (first 10 matches) */
const PROVISIONAL_K = 48;
/** K-factor for high-rated agents (2000+) */
const HIGH_RATING_K = 16;
/** Default starting rating */
const DEFAULT_RATING = 1200;

/**
 * ELO arena for palace agent competitions.
 */
export class EloArena {
  private records: Map<string, EloRecord>;

  constructor() {
    this.records = new Map();
  }

  /** Register an agent with starting ELO */
  register(agentId: string, initialRating = DEFAULT_RATING): void {
    if (this.records.has(agentId)) return;

    this.records.set(agentId, {
      agentId,
      rating: initialRating,
      peakRating: initialRating,
      matchCount: 0,
      winCount: 0,
      lossCount: 0,
      drawCount: 0,
      streak: 0,
      history: [],
    });
  }

  /** Get an agent's current rating */
  getRating(agentId: string): number {
    return this.records.get(agentId)?.rating ?? DEFAULT_RATING;
  }

  /** Get an agent's full record */
  getRecord(agentId: string): EloRecord | undefined {
    return this.records.get(agentId);
  }

  /** Record a match result and update ELO ratings */
  recordMatch(result: MatchResult): { winnerDelta: number; loserDelta: number } {
    this.ensureRegistered(result.winner);
    this.ensureRegistered(result.loser);

    const winnerRecord = this.records.get(result.winner)!;
    const loserRecord = this.records.get(result.loser)!;

    const kWinner = this.getKFactor(winnerRecord);
    const kLoser = this.getKFactor(loserRecord);

    // Expected scores
    const expectedWinner = this.expectedScore(winnerRecord.rating, loserRecord.rating);
    const expectedLoser = 1 - expectedWinner;

    let actualWinner: number;
    let actualLoser: number;

    if (result.isDraw) {
      actualWinner = 0.5;
      actualLoser = 0.5;
    } else {
      // Margin-adjusted score (0.75-1.0 for winner based on margin)
      actualWinner = 0.75 + result.margin * 0.25;
      actualLoser = 0;
    }

    const winnerDelta = Math.round(kWinner * (actualWinner - expectedWinner));
    const loserDelta = Math.round(kLoser * (actualLoser - expectedLoser));

    const now = new Date().toISOString();

    // Update winner
    const oldWinnerRating = winnerRecord.rating;
    winnerRecord.rating += winnerDelta;
    winnerRecord.peakRating = Math.max(winnerRecord.peakRating, winnerRecord.rating);
    winnerRecord.matchCount++;
    if (result.isDraw) {
      winnerRecord.drawCount++;
      winnerRecord.streak = 0;
    } else {
      winnerRecord.winCount++;
      winnerRecord.streak = winnerRecord.streak > 0 ? winnerRecord.streak + 1 : 1;
    }
    winnerRecord.history.push({
      timestamp: now,
      opponent: result.loser,
      oldRating: oldWinnerRating,
      newRating: winnerRecord.rating,
      result: result.isDraw ? 'draw' : 'win',
      reason: result.reason,
    });

    // Update loser
    const oldLoserRating = loserRecord.rating;
    loserRecord.rating += loserDelta;
    loserRecord.rating = Math.max(loserRecord.rating, 100); // floor at 100
    loserRecord.matchCount++;
    if (result.isDraw) {
      loserRecord.drawCount++;
      loserRecord.streak = 0;
    } else {
      loserRecord.lossCount++;
      loserRecord.streak = loserRecord.streak < 0 ? loserRecord.streak - 1 : -1;
    }
    loserRecord.history.push({
      timestamp: now,
      opponent: result.winner,
      oldRating: oldLoserRating,
      newRating: loserRecord.rating,
      result: result.isDraw ? 'draw' : 'loss',
      reason: result.reason,
    });

    return { winnerDelta, loserDelta };
  }

  /** Get leaderboard sorted by ELO rating */
  getLeaderboard(): EloRecord[] {
    return [...this.records.values()].sort((a, b) => b.rating - a.rating);
  }

  /** Get win rate for an agent */
  getWinRate(agentId: string): number {
    const record = this.records.get(agentId);
    if (!record || record.matchCount === 0) return 0;
    return record.winCount / record.matchCount;
  }

  /** Calculate expected score between two ratings */
  private expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /** Determine K-factor based on agent experience and rating */
  private getKFactor(record: EloRecord): number {
    if (record.matchCount < 10) return PROVISIONAL_K;
    if (record.rating >= 2000) return HIGH_RATING_K;
    return DEFAULT_K;
  }

  /** Ensure an agent is registered before a match */
  private ensureRegistered(agentId: string): void {
    if (!this.records.has(agentId)) {
      this.register(agentId);
    }
  }
}
