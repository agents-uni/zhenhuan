/**
 * Palace Resource Manager - 后宫资源管理
 *
 * Wraps agents-uni-core ResourcePool with palace-specific semantics:
 * - 圣宠 (favor): finite, competitive, decays over time
 * - 月例 (allowance): renewable, distributed by hierarchy
 * - 宫殿 (palaces): positional, 12 total palaces
 * - 侍女 (maids): finite, distributed by merit, 100 total
 */

import { ResourcePool } from '@agents-uni/core';
import type { ResourceDefinition } from '@agents-uni/core';
import { getRankByLevel } from './ranks.js';

/** Palace-specific resource definitions */
export const PALACE_RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  {
    name: '圣宠',
    type: 'finite',
    total: 1000,
    distribution: 'competitive',
    decayRate: 0.05,
    description: 'Imperial favor - won through competition, decays over time',
  },
  {
    name: '月例',
    type: 'renewable',
    total: 10000,
    distribution: 'hierarchy',
    refreshInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
    description: 'Monthly allowance - distributed based on rank',
  },
  {
    name: '宫殿',
    type: 'positional',
    total: 12,
    distribution: 'hierarchy',
    description: 'Palace residences - tied to rank and position',
  },
  {
    name: '侍女',
    type: 'finite',
    total: 100,
    distribution: 'merit',
    description: 'Maids - assigned based on merit and performance',
  },
];

/** Palace names for the 12 available palaces */
export const PALACE_NAMES = [
  '景仁宫', '承乾宫', '钟粹宫', '延禧宫',
  '永和宫', '景阳宫', '翊坤宫', '永寿宫',
  '启祥宫', '长春宫', '咸福宫', '储秀宫',
] as const;

export interface ResourceSummary {
  agentId: string;
  favor: number;
  allowance: number;
  palace: string | null;
  maids: number;
}

/**
 * Manages palace-specific resources on top of the core ResourcePool.
 */
export class PalaceResourceManager {
  private pool: ResourcePool;
  private palaceAssignments: Map<string, string>; // agentId -> palaceName

  constructor(pool?: ResourcePool) {
    this.pool = pool ?? new ResourcePool(PALACE_RESOURCE_DEFINITIONS);
    this.palaceAssignments = new Map();
  }

  /** Get the underlying ResourcePool */
  getPool(): ResourcePool {
    return this.pool;
  }

  /** Grant imperial favor to an agent */
  grantFavor(agentId: string, amount: number, reason: string): boolean {
    return this.pool.allocate(agentId, '圣宠', amount, `恩赐圣宠: ${reason}`);
  }

  /** Revoke favor from an agent */
  revokeFavor(agentId: string, amount: number, reason: string): boolean {
    return this.pool.revoke(agentId, '圣宠', amount, `收回圣宠: ${reason}`);
  }

  /** Distribute monthly allowance based on each agent's rank level */
  distributeMonthlyAllowance(
    agents: Array<{ id: string; rankLevel: number }>
  ): Map<string, number> {
    const distributions = new Map<string, number>();

    for (const agent of agents) {
      const rank = getRankByLevel(agent.rankLevel);
      if (!rank) continue;

      const amount = rank.monthlyAllowance;
      const success = this.pool.allocate(
        agent.id,
        '月例',
        amount,
        `月例发放 - ${rank.title}`
      );

      if (success) {
        distributions.set(agent.id, amount);
      }
    }

    return distributions;
  }

  /** Assign a palace residence to an agent */
  assignPalace(agentId: string, palaceName: string): boolean {
    // Check if the palace name is valid
    if (!PALACE_NAMES.includes(palaceName as typeof PALACE_NAMES[number])) {
      return false;
    }

    // Check if the palace is already assigned
    for (const [existingAgent, existingPalace] of this.palaceAssignments) {
      if (existingPalace === palaceName && existingAgent !== agentId) {
        return false;
      }
    }

    // Remove agent's previous palace assignment
    this.palaceAssignments.delete(agentId);

    // Assign the new palace
    this.palaceAssignments.set(agentId, palaceName);

    // Track in the resource pool (1 unit = 1 palace)
    const currentBalance = this.pool.getBalance(agentId, '宫殿');
    if (currentBalance === 0) {
      this.pool.allocate(agentId, '宫殿', 1, `入住${palaceName}`);
    }

    return true;
  }

  /** Get the palace assigned to an agent */
  getPalace(agentId: string): string | null {
    return this.palaceAssignments.get(agentId) ?? null;
  }

  /** Release an agent's palace assignment */
  releasePalace(agentId: string): void {
    const palace = this.palaceAssignments.get(agentId);
    if (palace) {
      this.palaceAssignments.delete(agentId);
      this.pool.revoke(agentId, '宫殿', 1, `迁出${palace}`);
    }
  }

  /** Get available (unassigned) palaces */
  getAvailablePalaces(): string[] {
    const assigned = new Set(this.palaceAssignments.values());
    return PALACE_NAMES.filter(p => !assigned.has(p));
  }

  /** Get a summary of all resources for an agent */
  getResourceSummary(agentId: string): ResourceSummary {
    return {
      agentId,
      favor: this.pool.getBalance(agentId, '圣宠'),
      allowance: this.pool.getBalance(agentId, '月例'),
      palace: this.palaceAssignments.get(agentId) ?? null,
      maids: this.pool.getBalance(agentId, '侍女'),
    };
  }

  /** Apply favor decay to all agents */
  applyFavorDecay(): void {
    this.pool.applyDecay('圣宠');
  }

  /** Allocate maids to an agent */
  allocateMaids(agentId: string, count: number, reason: string): boolean {
    return this.pool.allocate(agentId, '侍女', count, `分配侍女: ${reason}`);
  }
}
