/**
 * Cold Palace (冷宫) - Elimination Zone
 *
 * Manages agents who have been banished from the palace.
 * Some may be rehabilitated, others permanently eliminated.
 */

import type { AgentRegistry, EventBus } from '@agents-uni/core';

export interface ColdPalaceInmate {
  agentId: string;
  name: string;
  reason: string;
  banishedAt: string;
  /** Duration in milliseconds. Undefined means indefinite. */
  duration?: number;
  /** When the sentence expires */
  expiresAt?: string;
  status: 'serving' | 'rehabilitated' | 'eliminated';
}

/**
 * The Cold Palace - where disgraced consorts are banished.
 */
export class ColdPalace {
  private inmates: Map<string, ColdPalaceInmate>;
  private registry: AgentRegistry;
  private events: EventBus;

  constructor(registry: AgentRegistry, events: EventBus) {
    this.inmates = new Map();
    this.registry = registry;
    this.events = events;
  }

  /** Banish an agent to the cold palace */
  async banish(agentId: string, reason: string, durationMs?: number): Promise<boolean> {
    const citizen = this.registry.get(agentId);
    if (!citizen) return false;

    if (citizen.status === 'eliminated') return false;
    if (this.inmates.has(agentId) && this.inmates.get(agentId)!.status === 'serving') {
      return false;
    }

    const now = new Date();
    const inmate: ColdPalaceInmate = {
      agentId,
      name: citizen.definition.name,
      reason,
      banishedAt: now.toISOString(),
      duration: durationMs,
      expiresAt: durationMs
        ? new Date(now.getTime() + durationMs).toISOString()
        : undefined,
      status: 'serving',
    };

    this.inmates.set(agentId, inmate);
    this.registry.setStatus(agentId, 'suspended');

    await this.events.emitSimple(
      'agent.suspended',
      [agentId],
      `${citizen.definition.name}被打入冷宫：${reason}`,
      { reason, duration: durationMs }
    );

    return true;
  }

  /** Rehabilitate an agent from the cold palace */
  async rehabilitate(agentId: string): Promise<boolean> {
    const inmate = this.inmates.get(agentId);
    if (!inmate || inmate.status !== 'serving') return false;

    inmate.status = 'rehabilitated';
    this.registry.setStatus(agentId, 'idle');

    await this.events.emitSimple(
      'agent.reinstated',
      [agentId],
      `${inmate.name}重获恩宠，从冷宫复出`,
      { agentId }
    );

    return true;
  }

  /** Permanently eliminate an agent */
  async eliminate(agentId: string): Promise<boolean> {
    const inmate = this.inmates.get(agentId);
    if (!inmate) {
      // Agent might not be in cold palace yet; banish first
      const citizen = this.registry.get(agentId);
      if (!citizen) return false;

      this.inmates.set(agentId, {
        agentId,
        name: citizen.definition.name,
        reason: '永久除名',
        banishedAt: new Date().toISOString(),
        status: 'eliminated',
      });
    } else {
      inmate.status = 'eliminated';
    }

    this.registry.setStatus(agentId, 'eliminated');

    const name = inmate?.name ?? agentId;
    await this.events.emitSimple(
      'agent.eliminated',
      [agentId],
      `${name}被永久除名，再无翻身之日`,
      { agentId }
    );

    return true;
  }

  /** Get all current inmates (those still serving) */
  getInmates(): ColdPalaceInmate[] {
    return [...this.inmates.values()].filter(i => i.status === 'serving');
  }

  /** Get all records (including rehabilitated and eliminated) */
  getAllRecords(): ColdPalaceInmate[] {
    return [...this.inmates.values()];
  }

  /** Check if any inmates have served their time and can be paroled */
  checkParole(): ColdPalaceInmate[] {
    const now = new Date().toISOString();
    const eligible: ColdPalaceInmate[] = [];

    for (const inmate of this.inmates.values()) {
      if (
        inmate.status === 'serving' &&
        inmate.expiresAt &&
        inmate.expiresAt <= now
      ) {
        eligible.push(inmate);
      }
    }

    return eligible;
  }

  /** Check if an agent is currently in the cold palace */
  isInColdPalace(agentId: string): boolean {
    const inmate = this.inmates.get(agentId);
    return inmate !== undefined && inmate.status === 'serving';
  }
}
