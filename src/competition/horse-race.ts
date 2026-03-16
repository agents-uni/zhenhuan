/**
 * Horse Race Engine - 赛马机制
 *
 * Multiple agents compete on the same task in parallel.
 * A judge evaluates outputs and determines winners/losers.
 * Results feed back into ELO ratings and rank progression.
 */

import type { EloArena, MatchResult } from './elo.js';

export interface HorseRaceTask {
  id: string;
  title: string;
  description: string;
  /** Maximum time allowed (ms) */
  timeLimit: number;
  /** Difficulty tier (1-5) */
  difficulty: number;
  /** Category for scoring */
  category: string;
  /** Evaluation criteria with weights */
  criteria: EvaluationCriterion[];
}

export interface EvaluationCriterion {
  name: string;
  weight: number;
  description: string;
}

export interface RaceEntry {
  agentId: string;
  output: string;
  completedAt: string;
  /** Time taken in ms */
  duration: number;
}

export interface JudgmentScore {
  agentId: string;
  criterionScores: Map<string, number>; // criterion name -> score (0-100)
  totalScore: number;
  feedback: string;
}

export interface RaceResult {
  taskId: string;
  startedAt: string;
  completedAt: string;
  entries: RaceEntry[];
  judgments: JudgmentScore[];
  rankings: string[]; // agent IDs from first to last
  eloChanges: Map<string, number>; // agentId -> rating change
  narrative: string;
}

export type JudgeFunction = (
  task: HorseRaceTask,
  entries: RaceEntry[]
) => Promise<JudgmentScore[]>;

/**
 * Runs competitive horse races between agents.
 */
export class HorseRaceEngine {
  private arena: EloArena;
  private history: RaceResult[];

  constructor(arena: EloArena) {
    this.arena = arena;
    this.history = [];
  }

  /**
   * Evaluate a completed race: judge entries, update ELO, return results.
   */
  async evaluateRace(
    task: HorseRaceTask,
    entries: RaceEntry[],
    judge: JudgeFunction
  ): Promise<RaceResult> {
    if (entries.length < 2) {
      throw new Error('Horse race requires at least 2 entries');
    }

    // Get judgments from the judge function
    const judgments = await judge(task, entries);

    // Sort by total score to get rankings
    const sorted = [...judgments].sort((a, b) => b.totalScore - a.totalScore);
    const rankings = sorted.map(j => j.agentId);

    // Update ELO for all pairwise matchups
    const eloChanges = new Map<string, number>();
    for (const id of rankings) {
      eloChanges.set(id, 0);
    }

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const higher = sorted[i];
        const lower = sorted[j];
        const scoreDiff = higher.totalScore - lower.totalScore;

        const matchResult: MatchResult = {
          winner: higher.agentId,
          loser: lower.agentId,
          isDraw: scoreDiff < 5, // within 5 points = draw
          reason: `赛马: ${task.title}`,
          margin: Math.min(scoreDiff / 100, 1),
        };

        const deltas = this.arena.recordMatch(matchResult);
        eloChanges.set(
          higher.agentId,
          (eloChanges.get(higher.agentId) ?? 0) + deltas.winnerDelta
        );
        eloChanges.set(
          lower.agentId,
          (eloChanges.get(lower.agentId) ?? 0) + deltas.loserDelta
        );
      }
    }

    const result: RaceResult = {
      taskId: task.id,
      startedAt: entries[0]?.completedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      entries,
      judgments,
      rankings,
      eloChanges,
      narrative: this.generateNarrative(task, sorted, rankings),
    };

    this.history.push(result);
    return result;
  }

  /** Get race history */
  getHistory(): RaceResult[] {
    return [...this.history];
  }

  /** Get an agent's race statistics */
  getAgentStats(agentId: string): {
    totalRaces: number;
    firstPlace: number;
    topThree: number;
    averageScore: number;
  } {
    let totalRaces = 0;
    let firstPlace = 0;
    let topThree = 0;
    let totalScore = 0;

    for (const race of this.history) {
      const rankIndex = race.rankings.indexOf(agentId);
      if (rankIndex === -1) continue;

      totalRaces++;
      if (rankIndex === 0) firstPlace++;
      if (rankIndex < 3) topThree++;

      const judgment = race.judgments.find(j => j.agentId === agentId);
      if (judgment) {
        totalScore += judgment.totalScore;
      }
    }

    return {
      totalRaces,
      firstPlace,
      topThree,
      averageScore: totalRaces > 0 ? totalScore / totalRaces : 0,
    };
  }

  private generateNarrative(
    task: HorseRaceTask,
    sorted: JudgmentScore[],
    rankings: string[]
  ): string {
    const parts: string[] = [`赛马「${task.title}」结果揭晓：`];

    if (rankings.length > 0) {
      const winner = sorted[0];
      parts.push(`魁首: ${winner.agentId} (${winner.totalScore.toFixed(1)}分)`);
    }
    if (rankings.length > 1) {
      parts.push(`次席: ${sorted[1].agentId} (${sorted[1].totalScore.toFixed(1)}分)`);
    }
    if (rankings.length > 2) {
      parts.push(`探花: ${sorted[2].agentId} (${sorted[2].totalScore.toFixed(1)}分)`);
    }

    return parts.join(' ');
  }
}
