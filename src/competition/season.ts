/**
 * Season System - 赛季制度
 *
 * Organizes competitions into seasons with clear start/end,
 * promotion/relegation at season boundaries, and seasonal rewards.
 */

import type { EloArena } from './elo.js';
import type { PalaceCeremonies } from '../palace/ceremonies.js';
import type { PalaceResourceManager } from '../palace/resources.js';
import { canPromote, isRankFull, getNextRank, getPreviousRank } from '../palace/ranks.js';

export interface SeasonConfig {
  /** Season duration in days */
  durationDays: number;
  /** Minimum races to qualify for promotion/relegation */
  minRaces: number;
  /** Top N% get promoted */
  promotionRate: number;
  /** Bottom N% get relegated */
  relegationRate: number;
  /** Favor bonus for first place */
  firstPlaceBonus: number;
  /** Favor bonus for second place */
  secondPlaceBonus: number;
  /** Favor bonus for third place */
  thirdPlaceBonus: number;
}

export interface Season {
  id: string;
  number: number;
  startedAt: string;
  endsAt: string;
  status: 'active' | 'completed';
  config: SeasonConfig;
}

export interface SeasonStanding {
  agentId: string;
  elo: number;
  races: number;
  wins: number;
  rank: number;
}

export interface SeasonResult {
  season: Season;
  standings: SeasonStanding[];
  promotions: string[];
  relegations: string[];
  rewards: Map<string, number>;
  narrative: string;
}

const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  durationDays: 30,
  minRaces: 3,
  promotionRate: 0.2,
  relegationRate: 0.15,
  firstPlaceBonus: 100,
  secondPlaceBonus: 60,
  thirdPlaceBonus: 30,
};

/**
 * Manages competitive seasons in the palace.
 */
export class SeasonEngine {
  private arena: EloArena;
  private ceremonies: PalaceCeremonies;
  private resources: PalaceResourceManager;
  private seasons: Season[];
  private config: SeasonConfig;

  constructor(
    arena: EloArena,
    ceremonies: PalaceCeremonies,
    resources: PalaceResourceManager,
    config?: Partial<SeasonConfig>
  ) {
    this.arena = arena;
    this.ceremonies = ceremonies;
    this.resources = resources;
    this.seasons = [];
    this.config = { ...DEFAULT_SEASON_CONFIG, ...config };
  }

  /** Start a new season */
  startSeason(): Season {
    const now = new Date();
    const endsAt = new Date(now.getTime() + this.config.durationDays * 24 * 60 * 60 * 1000);

    const season: Season = {
      id: `season-${this.seasons.length + 1}`,
      number: this.seasons.length + 1,
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      status: 'active',
      config: { ...this.config },
    };

    this.seasons.push(season);
    return season;
  }

  /** Get current active season */
  getCurrentSeason(): Season | undefined {
    return this.seasons.find(s => s.status === 'active');
  }

  /** End the current season and process results */
  async endSeason(
    agentRankLevels: Map<string, number>
  ): Promise<SeasonResult> {
    const season = this.getCurrentSeason();
    if (!season) {
      throw new Error('No active season');
    }

    season.status = 'completed';

    // Build standings from ELO leaderboard
    const leaderboard = this.arena.getLeaderboard();
    const standings: SeasonStanding[] = leaderboard.map((record, index) => ({
      agentId: record.agentId,
      elo: record.rating,
      races: record.matchCount,
      wins: record.winCount,
      rank: index + 1,
    }));

    // Filter qualified agents
    const qualified = standings.filter(s => s.races >= this.config.minRaces);

    // Determine promotions (top N%)
    const promotionCount = Math.max(1, Math.floor(qualified.length * this.config.promotionRate));
    const promotionCandidates = qualified.slice(0, promotionCount);
    const promotions: string[] = [];

    for (const candidate of promotionCandidates) {
      const currentLevel = agentRankLevels.get(candidate.agentId) ?? 1;
      if (canPromote(currentLevel, candidate.elo)) {
        const nextRank = getNextRank(currentLevel);
        if (nextRank) {
          // Count occupants (simplified - caller should provide accurate data)
          try {
            await this.ceremonies.conductPromotion(candidate.agentId, nextRank.level);
            promotions.push(candidate.agentId);
          } catch {
            // Promotion failed (rank full, etc.)
          }
        }
      }
    }

    // Determine relegations (bottom N%)
    const relegationCount = Math.max(1, Math.floor(qualified.length * this.config.relegationRate));
    const relegationCandidates = qualified.slice(-relegationCount);
    const relegations: string[] = [];

    for (const candidate of relegationCandidates) {
      const currentLevel = agentRankLevels.get(candidate.agentId) ?? 1;
      if (currentLevel > 1) {
        const prevRank = getPreviousRank(currentLevel);
        if (prevRank) {
          try {
            await this.ceremonies.conductDemotion(candidate.agentId, prevRank.level);
            relegations.push(candidate.agentId);
          } catch {
            // Demotion failed
          }
        }
      }
    }

    // Distribute rewards
    const rewards = new Map<string, number>();
    if (qualified.length >= 1) {
      this.resources.grantFavor(qualified[0].agentId, this.config.firstPlaceBonus, '赛季冠军');
      rewards.set(qualified[0].agentId, this.config.firstPlaceBonus);
    }
    if (qualified.length >= 2) {
      this.resources.grantFavor(qualified[1].agentId, this.config.secondPlaceBonus, '赛季亚军');
      rewards.set(qualified[1].agentId, this.config.secondPlaceBonus);
    }
    if (qualified.length >= 3) {
      this.resources.grantFavor(qualified[2].agentId, this.config.thirdPlaceBonus, '赛季季军');
      rewards.set(qualified[2].agentId, this.config.thirdPlaceBonus);
    }

    const result: SeasonResult = {
      season,
      standings,
      promotions,
      relegations,
      rewards,
      narrative: this.generateSeasonNarrative(season, standings, promotions, relegations),
    };

    return result;
  }

  /** Get all seasons */
  getSeasons(): Season[] {
    return [...this.seasons];
  }

  private generateSeasonNarrative(
    season: Season,
    standings: SeasonStanding[],
    promotions: string[],
    relegations: string[]
  ): string {
    const parts = [`第${season.number}赛季落幕。`];

    if (standings.length > 0) {
      parts.push(`本季魁首：${standings[0].agentId}（${standings[0].elo}分）。`);
    }
    if (promotions.length > 0) {
      parts.push(`${promotions.length}人晋升品级。`);
    }
    if (relegations.length > 0) {
      parts.push(`${relegations.length}人遭贬谪。`);
    }

    return parts.join('');
  }
}
