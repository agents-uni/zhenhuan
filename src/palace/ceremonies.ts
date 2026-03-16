/**
 * Palace Ceremonies - 宫廷典礼
 *
 * Handles formal palace events: court assemblies, selections,
 * promotions, demotions, and eliminations.
 */

import type { AgentRegistry, EventBus } from '@agents-uni/core';
import type { AgentDefinition } from '@agents-uni/core';
import { getRankByLevel, getRankByTitle, getNextRank, getPreviousRank, canPromote, isRankFull } from './ranks.js';
import type { PalaceRank } from './ranks.js';

export interface CeremonyResult {
  type: 'court_assembly' | 'selection' | 'promotion' | 'demotion' | 'elimination';
  timestamp: string;
  participants: string[];
  outcomes: CeremonyOutcome[];
  narrative: string;
}

export interface CeremonyOutcome {
  agentId: string;
  action: string;
  details: Record<string, unknown>;
}

/**
 * Manages formal palace ceremonies and rituals.
 */
export class PalaceCeremonies {
  private registry: AgentRegistry;
  private events: EventBus;
  private ceremonyHistory: CeremonyResult[];

  constructor(registry: AgentRegistry, events: EventBus) {
    this.registry = registry;
    this.events = events;
    this.ceremonyHistory = [];
  }

  /**
   * Conduct monthly court assembly (朝会).
   * Reviews rankings and triggers promotions/demotions.
   */
  async conductCourtAssembly(
    agentPerformances: Map<string, number>,
    eloRatings: Map<string, number>
  ): Promise<CeremonyResult> {
    const outcomes: CeremonyOutcome[] = [];
    const participants: string[] = [];

    // Evaluate each active consort
    const citizens = this.registry.getAll().filter(
      c => c.status === 'active' || c.status === 'idle'
    );

    for (const citizen of citizens) {
      const agentId = citizen.definition.id;
      participants.push(agentId);

      const performance = agentPerformances.get(agentId) ?? 50;
      const elo = eloRatings.get(agentId) ?? 1200;
      const currentRankLevel = this.extractRankLevel(citizen.definition);

      // Check for promotion eligibility
      if (performance >= 75 && canPromote(currentRankLevel, elo)) {
        const nextRank = getNextRank(currentRankLevel);
        if (nextRank) {
          // Count current occupants at next rank
          const occupantsAtNextRank = citizens.filter(
            c => this.extractRankLevel(c.definition) === nextRank.level
          ).length;

          if (!isRankFull(nextRank.level, occupantsAtNextRank)) {
            outcomes.push({
              agentId,
              action: 'promotion_eligible',
              details: {
                currentLevel: currentRankLevel,
                targetLevel: nextRank.level,
                targetTitle: nextRank.title,
                elo,
                performance,
              },
            });
          }
        }
      }

      // Check for demotion
      if (performance < 30 && currentRankLevel > 1) {
        const prevRank = getPreviousRank(currentRankLevel);
        if (prevRank) {
          outcomes.push({
            agentId,
            action: 'demotion_recommended',
            details: {
              currentLevel: currentRankLevel,
              targetLevel: prevRank.level,
              targetTitle: prevRank.title,
              performance,
            },
          });
        }
      }
    }

    const result: CeremonyResult = {
      type: 'court_assembly',
      timestamp: new Date().toISOString(),
      participants,
      outcomes,
      narrative: this.generateCourtNarrative(outcomes),
    };

    this.ceremonyHistory.push(result);

    await this.events.emitSimple(
      'custom',
      participants,
      result.narrative,
      { ceremonyType: 'court_assembly', outcomeCount: outcomes.length }
    );

    return result;
  }

  /**
   * Conduct selection ceremony (选秀) for new consorts.
   */
  async conductSelection(
    newAgents: AgentDefinition[]
  ): Promise<CeremonyResult> {
    const outcomes: CeremonyOutcome[] = [];
    const participants: string[] = [];

    for (const agent of newAgents) {
      try {
        this.registry.register(agent);
        this.registry.setStatus(agent.id, 'idle');
        participants.push(agent.id);

        outcomes.push({
          agentId: agent.id,
          action: 'selected',
          details: {
            name: agent.name,
            role: agent.role.title,
            rank: agent.rank,
          },
        });

        await this.events.emitSimple(
          'agent.joined',
          [agent.id],
          `${agent.name}通过选秀入宫，初封${agent.role.title}`,
          { agentId: agent.id }
        );
      } catch (error) {
        outcomes.push({
          agentId: agent.id,
          action: 'selection_failed',
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    const result: CeremonyResult = {
      type: 'selection',
      timestamp: new Date().toISOString(),
      participants,
      outcomes,
      narrative: `选秀大典：${newAgents.length}位秀女参选，${outcomes.filter(o => o.action === 'selected').length}位入选。`,
    };

    this.ceremonyHistory.push(result);
    return result;
  }

  /**
   * Conduct promotion ceremony (晋升典礼).
   */
  async conductPromotion(
    agentId: string,
    newRankLevel: number
  ): Promise<CeremonyResult> {
    const citizen = this.registry.get(agentId);
    if (!citizen) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    const newRank = getRankByLevel(newRankLevel);
    if (!newRank) {
      throw new Error(`Invalid rank level: ${newRankLevel}`);
    }

    const oldRankLevel = this.extractRankLevel(citizen.definition);
    const oldRank = getRankByLevel(oldRankLevel);

    // Update the agent's role title and rank
    citizen.definition.role.title = newRank.title;
    citizen.definition.rank = newRankLevel * 10;

    const outcome: CeremonyOutcome = {
      agentId,
      action: 'promoted',
      details: {
        oldRank: oldRank?.title ?? '未知',
        oldLevel: oldRankLevel,
        newRank: newRank.title,
        newLevel: newRankLevel,
      },
    };

    const narrative = `晋升典礼：${citizen.definition.name}由${oldRank?.title ?? '未知'}晋升为${newRank.title}，恩泽浩荡。`;

    await this.events.emitSimple(
      'agent.promoted',
      [agentId],
      narrative,
      outcome.details
    );

    const result: CeremonyResult = {
      type: 'promotion',
      timestamp: new Date().toISOString(),
      participants: [agentId],
      outcomes: [outcome],
      narrative,
    };

    this.ceremonyHistory.push(result);
    return result;
  }

  /**
   * Conduct demotion (贬谪).
   */
  async conductDemotion(
    agentId: string,
    newRankLevel: number
  ): Promise<CeremonyResult> {
    const citizen = this.registry.get(agentId);
    if (!citizen) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    const newRank = getRankByLevel(newRankLevel);
    if (!newRank) {
      throw new Error(`Invalid rank level: ${newRankLevel}`);
    }

    const oldRankLevel = this.extractRankLevel(citizen.definition);
    const oldRank = getRankByLevel(oldRankLevel);

    citizen.definition.role.title = newRank.title;
    citizen.definition.rank = newRankLevel * 10;

    const outcome: CeremonyOutcome = {
      agentId,
      action: 'demoted',
      details: {
        oldRank: oldRank?.title ?? '未知',
        oldLevel: oldRankLevel,
        newRank: newRank.title,
        newLevel: newRankLevel,
      },
    };

    const narrative = `贬谪旨意：${citizen.definition.name}由${oldRank?.title ?? '未知'}贬为${newRank.title}，以儆效尤。`;

    await this.events.emitSimple(
      'agent.demoted',
      [agentId],
      narrative,
      outcome.details
    );

    const result: CeremonyResult = {
      type: 'demotion',
      timestamp: new Date().toISOString(),
      participants: [agentId],
      outcomes: [outcome],
      narrative,
    };

    this.ceremonyHistory.push(result);
    return result;
  }

  /**
   * Conduct elimination (打入冷宫).
   */
  async conductElimination(agentId: string): Promise<CeremonyResult> {
    const citizen = this.registry.get(agentId);
    if (!citizen) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    this.registry.setStatus(agentId, 'suspended');

    const outcome: CeremonyOutcome = {
      agentId,
      action: 'eliminated',
      details: {
        name: citizen.definition.name,
        formerRank: citizen.definition.role.title,
      },
    };

    const narrative = `${citizen.definition.name}被打入冷宫，昔日荣华尽失。`;

    await this.events.emitSimple(
      'agent.suspended',
      [agentId],
      narrative,
      outcome.details
    );

    const result: CeremonyResult = {
      type: 'elimination',
      timestamp: new Date().toISOString(),
      participants: [agentId],
      outcomes: [outcome],
      narrative,
    };

    this.ceremonyHistory.push(result);
    return result;
  }

  /** Get ceremony history */
  getHistory(): CeremonyResult[] {
    return [...this.ceremonyHistory];
  }

  /** Extract a numeric rank level from an agent definition */
  private extractRankLevel(definition: AgentDefinition): number {
    // Derive level from rank value (rank / 10), or look up by title
    if (definition.rank !== undefined) {
      const level = Math.round(definition.rank / 10);
      if (level >= 1 && level <= 8) return level;
    }
    // Fallback: match by title
    const match = getRankByTitle(definition.role.title);
    return match?.level ?? 1;
  }

  private generateCourtNarrative(outcomes: CeremonyOutcome[]): string {
    const promotions = outcomes.filter(o => o.action === 'promotion_eligible');
    const demotions = outcomes.filter(o => o.action === 'demotion_recommended');

    const parts: string[] = ['朝会已毕。'];

    if (promotions.length > 0) {
      parts.push(`${promotions.length}人表现优异，可堪晋升。`);
    }
    if (demotions.length > 0) {
      parts.push(`${demotions.length}人表现不佳，建议贬谪。`);
    }
    if (promotions.length === 0 && demotions.length === 0) {
      parts.push('众妃嫔表现平稳，无需调整品级。');
    }

    return parts.join('');
  }
}
