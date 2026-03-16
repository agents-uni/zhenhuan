/**
 * zhenhuan-uni — 甄嬛后宫 Agent 赛马系统
 *
 * 基于 agents-uni-core 构建的后宫竞争体系。
 * 通过品级晋升、ELO 赛马、势力博弈三大机制激发 Agent 潜力。
 *
 * @module zhenhuan-uni
 */

// Palace domain modules
export { PalaceResourceManager, PALACE_RESOURCE_DEFINITIONS, PALACE_NAMES } from './palace/resources.js';
export type { ResourceSummary } from './palace/resources.js';

export { PALACE_RANKS, getRankByLevel, getRankByTitle, getNextRank, getPreviousRank, canPromote, isRankFull } from './palace/ranks.js';
export type { PalaceRank } from './palace/ranks.js';

export { PalaceDynamics } from './palace/dynamics.js';
export type { AllianceRecord, BetrayalRecord, Faction } from './palace/dynamics.js';

export { PalaceCeremonies } from './palace/ceremonies.js';
export type { CeremonyResult, CeremonyOutcome } from './palace/ceremonies.js';

export { ColdPalace } from './palace/cold-palace.js';
export type { ColdPalaceInmate } from './palace/cold-palace.js';

// Competition engine
export { EloArena } from './competition/elo.js';
export type { EloRecord, EloChange, MatchResult } from './competition/elo.js';

export { HorseRaceEngine } from './competition/horse-race.js';
export type {
  HorseRaceTask,
  EvaluationCriterion,
  RaceEntry,
  JudgmentScore,
  RaceResult,
  JudgeFunction,
} from './competition/horse-race.js';

export { SeasonEngine } from './competition/season.js';
export type { Season, SeasonConfig, SeasonResult, SeasonStanding } from './competition/season.js';

// Orchestrator
export { PalaceOrchestrator } from './orchestrator/index.js';
export type { OrchestratorConfig, PalaceState } from './orchestrator/index.js';

// Re-export dispatch types from agents-uni-core for convenience
export type {
  DispatchTask,
  DispatchResult,
  AgentSubmission,
  WorkspaceIO,
} from '@agents-uni/core';
export { TaskDispatcher, FileWorkspaceIO, MemoryWorkspaceIO } from '@agents-uni/core';
