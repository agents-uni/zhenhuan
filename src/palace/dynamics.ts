/**
 * Palace Dynamics - 后宫势力与关系
 *
 * Manages alliances, betrayals, factions, and influence calculations
 * within the palace hierarchy.
 */

import type { RelationshipGraph } from '@agents-uni/core';
import type { AgentRegistry } from '@agents-uni/core';
import type { ResourcePool } from '@agents-uni/core';

export interface AllianceRecord {
  agent1: string;
  agent2: string;
  reason: string;
  formedAt: string;
}

export interface BetrayalRecord {
  betrayer: string;
  betrayed: string;
  reason: string;
  occurredAt: string;
}

export interface Faction {
  id: string;
  members: string[];
  leader: string;
  influence: number;
}

/**
 * Manages the complex political dynamics of the palace.
 */
export class PalaceDynamics {
  private graph: RelationshipGraph;
  private registry: AgentRegistry;
  private resources: ResourcePool;
  private allianceHistory: AllianceRecord[];
  private betrayalHistory: BetrayalRecord[];

  constructor(
    graph: RelationshipGraph,
    registry: AgentRegistry,
    resources: ResourcePool
  ) {
    this.graph = graph;
    this.registry = registry;
    this.resources = resources;
    this.allianceHistory = [];
    this.betrayalHistory = [];
  }

  /** Form an alliance between two agents */
  formAlliance(agent1: string, agent2: string, reason: string): boolean {
    // Verify both agents exist and are active
    const citizen1 = this.registry.get(agent1);
    const citizen2 = this.registry.get(agent2);
    if (!citizen1 || !citizen2) return false;
    if (citizen1.status !== 'active' && citizen1.status !== 'idle') return false;
    if (citizen2.status !== 'active' && citizen2.status !== 'idle') return false;

    // Check if they are already allies
    const allies = this.graph.getAllies(agent1);
    if (allies.includes(agent2)) return false;

    // Add mutual ally relationships
    this.graph.addRelationship({
      from: agent1,
      to: agent2,
      type: 'ally',
      weight: 0.7,
      mutable: true,
    });
    this.graph.addRelationship({
      from: agent2,
      to: agent1,
      type: 'ally',
      weight: 0.7,
      mutable: true,
    });

    this.allianceHistory.push({
      agent1,
      agent2,
      reason,
      formedAt: new Date().toISOString(),
    });

    return true;
  }

  /** Betray an alliance, creating a rivalry */
  betrayAlliance(betrayer: string, betrayed: string, reason: string): boolean {
    // Verify they were allies
    const allies = this.graph.getAllies(betrayer);
    if (!allies.includes(betrayed)) return false;

    // Remove ally relationships by setting weight to 0
    this.graph.updateWeight(betrayer, betrayed, 'ally', 0, `背叛: ${reason}`);
    this.graph.updateWeight(betrayed, betrayer, 'ally', 0, `被背叛: ${reason}`);

    // Create rivalry
    this.graph.addRelationship({
      from: betrayer,
      to: betrayed,
      type: 'rival',
      weight: 0.9,
      mutable: true,
    });
    this.graph.addRelationship({
      from: betrayed,
      to: betrayer,
      type: 'rival',
      weight: 0.9,
      mutable: true,
    });

    this.betrayalHistory.push({
      betrayer,
      betrayed,
      reason,
      occurredAt: new Date().toISOString(),
    });

    return true;
  }

  /** Calculate an agent's influence based on rank, allies, and favor */
  calculateInfluence(agentId: string): number {
    const citizen = this.registry.get(agentId);
    if (!citizen) return 0;

    // Base influence from rank (0-100)
    const rankInfluence = (citizen.definition.rank ?? 0) * 1;

    // Influence from allies (each ally adds proportional to their rank)
    const allies = this.graph.getAllies(agentId);
    let allyInfluence = 0;
    for (const allyId of allies) {
      const ally = this.registry.get(allyId);
      if (ally) {
        allyInfluence += (ally.definition.rank ?? 0) * 0.3;
      }
    }

    // Influence from favor (圣宠)
    const favor = this.resources.getBalance(agentId, '圣宠');
    const favorInfluence = Math.min(favor * 0.1, 50);

    // Penalty from rivals
    const rivals = this.graph.getRivals(agentId);
    const rivalPenalty = rivals.length * 5;

    return Math.max(0, rankInfluence + allyInfluence + favorInfluence - rivalPenalty);
  }

  /** Get all factions (groups of allied agents) */
  getFactions(): Faction[] {
    const allAgents = this.registry.getAllIds();
    const visited = new Set<string>();
    const factions: Faction[] = [];
    let factionCounter = 0;

    for (const agentId of allAgents) {
      if (visited.has(agentId)) continue;

      const citizen = this.registry.get(agentId);
      if (!citizen || citizen.status === 'eliminated' || citizen.status === 'suspended') {
        continue;
      }

      // BFS to find all connected allies
      const faction: string[] = [];
      const queue = [agentId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        faction.push(current);

        const allies = this.graph.getAllies(current);
        for (const ally of allies) {
          if (!visited.has(ally)) {
            const allyCitizen = this.registry.get(ally);
            if (allyCitizen && allyCitizen.status !== 'eliminated' && allyCitizen.status !== 'suspended') {
              queue.push(ally);
            }
          }
        }
      }

      if (faction.length > 1) {
        // Find the leader (highest rank in the faction)
        const leader = faction.reduce((best, id) => {
          const bestCitizen = this.registry.get(best);
          const currentCitizen = this.registry.get(id);
          const bestRank = bestCitizen?.definition.rank ?? 0;
          const currentRank = currentCitizen?.definition.rank ?? 0;
          return currentRank > bestRank ? id : best;
        });

        const influence = faction.reduce(
          (sum, id) => sum + this.calculateInfluence(id),
          0
        );

        factions.push({
          id: `faction-${++factionCounter}`,
          members: faction,
          leader,
          influence,
        });
      }
    }

    return factions.sort((a, b) => b.influence - a.influence);
  }

  /** Check if a challenger can challenge a target (adjacent ranks only) */
  canChallenge(challengerId: string, targetId: string): boolean {
    const challenger = this.registry.get(challengerId);
    const target = this.registry.get(targetId);

    if (!challenger || !target) return false;
    if (challenger.status !== 'active' && challenger.status !== 'idle') return false;
    if (target.status !== 'active' && target.status !== 'idle') return false;

    const challengerRank = challenger.definition.rank ?? 0;
    const targetRank = target.definition.rank ?? 0;

    // Can only challenge adjacent ranks (within 1 level)
    return Math.abs(challengerRank - targetRank) <= 1 && challengerRank !== targetRank;
  }

  /** Get alliance history */
  getAllianceHistory(): AllianceRecord[] {
    return [...this.allianceHistory];
  }

  /** Get betrayal history */
  getBetrayalHistory(): BetrayalRecord[] {
    return [...this.betrayalHistory];
  }
}
