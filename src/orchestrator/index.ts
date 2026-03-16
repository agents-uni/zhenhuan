/**
 * Palace Orchestrator - 后宫调度中枢
 *
 * The central coordination engine that ties together:
 * - Universe (agents-uni-core) for organizational structure
 * - ELO Arena for competitive ratings
 * - Horse Race Engine for task competitions
 * - Season Engine for periodic evaluation
 * - Palace modules for domain-specific mechanics
 *
 * 设计理念：用户就是皇帝。所有嫔妃 Agent 为用户竞争，
 * 用户通过 API / Dashboard / CLI 以皇帝身份裁决一切。
 */

import {
  Universe,
  PerformanceTracker,
  parseSpecFile,
  compileUniverse,
  TaskDispatcher,
  FileWorkspaceIO,
} from '@agents-uni/core';
import type {
  OrganizationEvent,
  EvolutionConfig,
  DispatchTask,
  DispatchResult,
  WorkspaceIO,
  DispatcherOptions,
} from '@agents-uni/core';

import { EloArena } from '../competition/elo.js';
import { HorseRaceEngine } from '../competition/horse-race.js';
import type { HorseRaceTask, RaceEntry, JudgeFunction, RaceResult } from '../competition/horse-race.js';
import { SeasonEngine } from '../competition/season.js';
import type { SeasonConfig } from '../competition/season.js';
import { PalaceResourceManager } from '../palace/resources.js';
import { PalaceDynamics } from '../palace/dynamics.js';
import { PalaceCeremonies } from '../palace/ceremonies.js';
import { ColdPalace } from '../palace/cold-palace.js';
import { getRankByLevel } from '../palace/ranks.js';

export interface OrchestratorConfig {
  specPath?: string;
  seasonConfig?: Partial<SeasonConfig>;
  autoStartSeason?: boolean;
  /** OpenClaw workspace directory for file-based dispatch */
  openclawDir?: string;
  /** Custom WorkspaceIO backend (overrides openclawDir) */
  workspaceIO?: WorkspaceIO;
  /** Dispatcher polling interval in ms */
  pollIntervalMs?: number;
}

export interface PalaceState {
  agents: Array<{
    id: string;
    name: string;
    rank: string;
    rankLevel: number;
    elo: number;
    status: string;
    favor: number;
  }>;
  currentSeason: number | null;
  factions: Array<{ id: string; members: string[]; leader: string; influence: number }>;
  coldPalaceInmates: string[];
  recentEvents: Array<{ type: string; description: string; timestamp: string }>;
}

/** Default evolution config for the palace */
const DEFAULT_EVOLUTION: EvolutionConfig = {
  performanceWindow: 50,
  promotionThreshold: 75,
  demotionThreshold: 30,
  memoryRetention: 1000,
};

/**
 * Central orchestrator for the Zhen Huan palace universe.
 */
export class PalaceOrchestrator {
  // Core infrastructure
  readonly universe: Universe;

  // Competition
  readonly arena: EloArena;
  readonly horseRace: HorseRaceEngine;
  readonly seasonEngine: SeasonEngine;

  // Palace domain
  readonly resources: PalaceResourceManager;
  readonly dynamics: PalaceDynamics;
  readonly ceremonies: PalaceCeremonies;
  readonly coldPalace: ColdPalace;

  // Evolution
  readonly performanceTracker: PerformanceTracker;

  // Dispatcher (file-based task dispatch to OpenClaw workspaces)
  readonly dispatcher: TaskDispatcher;

  private initialized = false;

  constructor(universe: Universe, config?: Partial<OrchestratorConfig>) {
    this.universe = universe;

    // Initialize competition layer
    this.arena = new EloArena();
    this.horseRace = new HorseRaceEngine(this.arena);

    // Initialize palace domain
    this.resources = new PalaceResourceManager(universe.resources);
    this.dynamics = new PalaceDynamics(universe.graph, universe.agents, universe.resources);
    this.ceremonies = new PalaceCeremonies(universe.agents, universe.events);
    this.coldPalace = new ColdPalace(universe.agents, universe.events);
    this.performanceTracker = new PerformanceTracker(DEFAULT_EVOLUTION);

    // Initialize dispatcher
    const io = config?.workspaceIO ?? new FileWorkspaceIO({
      openclawDir: config?.openclawDir,
    });
    this.dispatcher = new TaskDispatcher(io, {
      pollIntervalMs: config?.pollIntervalMs,
      eventBus: universe.events,
    });

    // Season engine needs ceremonies and resources
    this.seasonEngine = new SeasonEngine(this.arena, this.ceremonies, this.resources);
  }

  /**
   * Create an orchestrator from a universe spec file.
   */
  static async fromSpec(
    specPath: string,
    config?: Partial<OrchestratorConfig>
  ): Promise<PalaceOrchestrator> {
    const uniConfig = parseSpecFile(specPath);
    const universe = await compileUniverse(uniConfig, { autoInit: true });
    const orchestrator = new PalaceOrchestrator(universe, config);
    await orchestrator.initialize();
    return orchestrator;
  }

  /**
   * Create an orchestrator from a Universe instance.
   */
  static fromUniverse(
    universe: Universe,
    config?: Partial<OrchestratorConfig>
  ): PalaceOrchestrator {
    const orchestrator = new PalaceOrchestrator(universe, config);
    orchestrator.initializeElo();
    orchestrator.initialized = true;
    return orchestrator;
  }

  /** Initialize the orchestrator: register agents in ELO arena */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.initializeElo();

    // Subscribe to key events for automatic reactions
    this.universe.events.subscribe(
      ['agent.promoted'],
      async (event: OrganizationEvent) => {
        const agentId = event.actors[0];
        if (agentId) {
          this.resources.grantFavor(agentId, 20, '晋升恩赐');
        }
      }
    );

    this.universe.events.subscribe(
      ['agent.demoted'],
      async (event: OrganizationEvent) => {
        const agentId = event.actors[0];
        if (agentId) {
          this.resources.revokeFavor(agentId, 30, '贬谪扣减');
        }
      }
    );

    this.initialized = true;
  }

  /** Register all agents in the ELO arena based on their rank */
  private initializeElo(): void {
    for (const citizen of this.universe.agents.getAll()) {
      const rank = citizen.definition.rank ?? 10;
      const startingElo = 1000 + rank * 5;
      this.arena.register(citizen.definition.id, startingElo);
    }
  }

  // ─── Competition API ─────────────────────────

  /**
   * Run a horse race: multiple agents compete on the same task.
   */
  async runHorseRace(
    task: HorseRaceTask,
    entries: RaceEntry[],
    judge: JudgeFunction
  ): Promise<RaceResult> {
    const result = await this.horseRace.evaluateRace(task, entries, judge);

    // Record performance for all participants
    for (const judgment of result.judgments) {
      this.performanceTracker.record(
        judgment.agentId,
        task.id,
        judgment.totalScore,
        Object.fromEntries(judgment.criterionScores)
      );
    }

    // Grant favor to top performers
    const rankings = result.rankings;
    if (rankings.length >= 1) {
      this.resources.grantFavor(rankings[0], 30, `赛马冠军: ${task.title}`);
    }
    if (rankings.length >= 2) {
      this.resources.grantFavor(rankings[1], 15, `赛马亚军: ${task.title}`);
    }

    return result;
  }

  /**
   * Full dispatch→collect→judge pipeline:
   * 1. Write TASK.md to each agent's OpenClaw workspace
   * 2. Poll for SUBMISSION.md until timeout
   * 3. Feed submissions into the horse race engine for scoring + ELO update
   *
   * This is the primary "one-click race" API that closes the loop between
   * OpenClaw workspaces and the competition engine.
   */
  async dispatchAndRace(
    task: DispatchTask & { difficulty?: number; category?: string },
    judge: JudgeFunction
  ): Promise<{ dispatch: DispatchResult; race: RaceResult | null }> {
    // 1. Dispatch task to OpenClaw workspaces and collect submissions
    const dispatchResult = await this.dispatcher.run(task);

    if (dispatchResult.submissions.length < 2) {
      // Not enough submissions for a race
      return { dispatch: dispatchResult, race: null };
    }

    // 2. Convert AgentSubmission → RaceEntry
    const entries: RaceEntry[] = dispatchResult.submissions.map((sub) => ({
      agentId: sub.agentId,
      output: sub.output,
      completedAt: sub.submittedAt,
      duration: sub.duration,
    }));

    // 3. Build HorseRaceTask from DispatchTask
    const horseRaceTask: HorseRaceTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      timeLimit: task.timeoutMs,
      difficulty: task.difficulty ?? 3,
      category: task.category ?? 'general',
      criteria: task.criteria,
    };

    // 4. Run the horse race (scoring + ELO update)
    const raceResult = await this.runHorseRace(horseRaceTask, entries, judge);

    return { dispatch: dispatchResult, race: raceResult };
  }

  /**
   * Run a monthly court assembly: review all agents and process promotions/demotions.
   */
  async runCourtAssembly(): Promise<void> {
    const performances = new Map<string, number>();
    const eloRatings = new Map<string, number>();

    for (const citizen of this.universe.agents.getAll()) {
      const id = citizen.definition.id;
      const avg = this.performanceTracker.getAverageScore(id);
      performances.set(id, avg);
      eloRatings.set(id, this.arena.getRating(id));
    }

    const result = await this.ceremonies.conductCourtAssembly(performances, eloRatings);

    for (const outcome of result.outcomes) {
      if (outcome.action === 'promotion_eligible') {
        const targetLevel = outcome.details.targetLevel as number;
        try {
          await this.ceremonies.conductPromotion(outcome.agentId, targetLevel);
        } catch {
          // Rank full or other issue
        }
      } else if (outcome.action === 'demotion_recommended') {
        const targetLevel = outcome.details.targetLevel as number;
        try {
          await this.ceremonies.conductDemotion(outcome.agentId, targetLevel);
        } catch {
          // Already at lowest rank
        }
      }
    }

    this.resources.applyFavorDecay();

    const eligible = this.coldPalace.checkParole();
    for (const inmate of eligible) {
      await this.coldPalace.rehabilitate(inmate.agentId);
    }
  }

  // ─── State Query API ─────────────────────────

  /** Get a snapshot of the current palace state */
  getState(): PalaceState {
    const agents = this.universe.agents.getAll().map((citizen) => {
      const id = citizen.definition.id;
      const rankLevel = Math.round((citizen.definition.rank ?? 10) / 10);
      const rank = getRankByLevel(rankLevel);

      return {
        id,
        name: citizen.definition.name,
        rank: rank?.title ?? '未知',
        rankLevel,
        elo: this.arena.getRating(id),
        status: citizen.status,
        favor: this.resources.getResourceSummary(id).favor,
      };
    });

    const currentSeason = this.seasonEngine.getCurrentSeason();
    const factions = this.dynamics.getFactions();
    const inmates = this.coldPalace.getInmates().map(i => i.agentId);

    const allEvents = this.universe.events.getLog(20);
    const recentEvents = allEvents.map((e) => ({
      type: e.type,
      description: e.narrative,
      timestamp: e.timestamp,
    }));

    return {
      agents,
      currentSeason: currentSeason?.number ?? null,
      factions,
      coldPalaceInmates: inmates,
      recentEvents,
    };
  }

  /** Get ELO leaderboard */
  getLeaderboard() {
    return this.arena.getLeaderboard();
  }

  /** Get an agent's comprehensive profile */
  getAgentProfile(agentId: string) {
    const citizen = this.universe.agents.get(agentId);
    if (!citizen) return null;

    return {
      ...citizen,
      elo: this.arena.getRecord(agentId) ?? { agentId, rating: 1000, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0 },
      resources: this.resources.getResourceSummary(agentId),
      influence: this.dynamics.calculateInfluence(agentId),
      raceStats: this.horseRace.getAgentStats(agentId),
      performance: this.performanceTracker.getAverageScore(agentId),
      inColdPalace: this.coldPalace.isInColdPalace(agentId),
    };
  }
}
