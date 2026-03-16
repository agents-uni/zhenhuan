/**
 * API Routes - 后宫 API 路由
 */

import { Hono } from 'hono';
import type { PalaceOrchestrator } from '../../orchestrator/index.js';
import type { HorseRaceTask, RaceEntry, JudgmentScore } from '../../competition/horse-race.js';
import type { DispatchTask, AgentDefinition } from '@agents-uni/core';
import { registerAgentsInOpenClaw } from '@agents-uni/core';

// ─── Input Validation Helpers ─────────────────

function validateRequired(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return `缺少必填字段: ${field}`;
    }
  }
  return null;
}

function validateAgentInputs(
  agents: Array<{ id?: string; name?: string; rank?: number }>
): string | null {
  if (!Array.isArray(agents) || agents.length === 0) {
    return '至少需要一个 agent';
  }
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a.id || typeof a.id !== 'string' || a.id.trim() === '') {
      return `agents[${i}].id 不能为空`;
    }
    if (!a.name || typeof a.name !== 'string' || a.name.trim() === '') {
      return `agents[${i}].name 不能为空`;
    }
    if (a.rank !== undefined && (typeof a.rank !== 'number' || a.rank < 0 || a.rank > 100)) {
      return `agents[${i}].rank 应在 0-100 之间`;
    }
  }
  return null;
}

export function createRoutes(orchestrator: PalaceOrchestrator): Hono {
  const app = new Hono();

  // ─── Global Error Handler ──────────────────
  app.onError((err, c) => {
    console.error('[API Error]', err);
    return c.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    );
  });

  // ─── State ────────────────────────────────

  /** Get current palace state */
  app.get('/state', (c) => {
    return c.json(orchestrator.getState());
  });

  /** Get ELO leaderboard */
  app.get('/leaderboard', (c) => {
    return c.json(orchestrator.getLeaderboard());
  });

  // ─── Agents ───────────────────────────────

  /** Get all agents */
  app.get('/agents', (c) => {
    const state = orchestrator.getState();
    return c.json(state.agents);
  });

  /** Get agent profile */
  app.get('/agents/:id', (c) => {
    const id = c.req.param('id');
    const profile = orchestrator.getAgentProfile(id);
    if (!profile) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    return c.json(profile);
  });

  // ─── Competition ──────────────────────────

  /** Submit a horse race result for evaluation */
  app.post('/race/evaluate', async (c) => {
    const body = await c.req.json<{
      task: HorseRaceTask;
      entries: RaceEntry[];
    }>();

    if (!body.task) return c.json({ error: '缺少 task 字段' }, 400);
    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return c.json({ error: '缺少 entries 字段或为空' }, 400);
    }

    // Simple scoring judge: scores based on output length and completion time
    const defaultJudge = async (task: HorseRaceTask, entries: RaceEntry[]) => {
      const judgments: JudgmentScore[] = entries.map(entry => {
        const criterionScores = new Map<string, number>();
        // Placeholder scoring - in production, this would call an LLM judge
        for (const criterion of task.criteria) {
          criterionScores.set(criterion.name, 50 + Math.random() * 50);
        }

        let totalScore = 0;
        let totalWeight = 0;
        for (const criterion of task.criteria) {
          const score = criterionScores.get(criterion.name) ?? 50;
          totalScore += score * criterion.weight;
          totalWeight += criterion.weight;
        }
        if (totalWeight > 0) {
          totalScore /= totalWeight;
        }

        return {
          agentId: entry.agentId,
          criterionScores,
          totalScore,
          feedback: `评分完毕`,
        };
      });

      return judgments;
    };

    const result = await orchestrator.runHorseRace(body.task, body.entries, defaultJudge);
    return c.json(result);
  });

  /**
   * Dispatch a task to OpenClaw workspaces, collect submissions, and run the race.
   * This is the full automated pipeline: dispatch → poll → judge → ELO update.
   */
  app.post('/race/dispatch', async (c) => {
    const body = await c.req.json<{
      task: DispatchTask & { difficulty?: number; category?: string };
    }>();

    // Validate required fields
    if (!body.task) return c.json({ error: '缺少 task 字段' }, 400);
    const taskErr = validateRequired(body.task as unknown as Record<string, unknown>, ['id', 'title', 'description', 'timeoutMs', 'participants']);
    if (taskErr) return c.json({ error: taskErr }, 400);
    if (!Array.isArray(body.task.participants) || body.task.participants.length < 2) {
      return c.json({ error: '至少需要 2 名参赛者' }, 400);
    }

    // Default judge: placeholder scoring (replace with LLM judge in production)
    const defaultJudge = async (task: HorseRaceTask, entries: RaceEntry[]) => {
      const judgments: JudgmentScore[] = entries.map(entry => {
        const criterionScores = new Map<string, number>();
        for (const criterion of task.criteria) {
          criterionScores.set(criterion.name, 50 + Math.random() * 50);
        }

        let totalScore = 0;
        let totalWeight = 0;
        for (const criterion of task.criteria) {
          const score = criterionScores.get(criterion.name) ?? 50;
          totalScore += score * criterion.weight;
          totalWeight += criterion.weight;
        }
        if (totalWeight > 0) totalScore /= totalWeight;

        return { agentId: entry.agentId, criterionScores, totalScore, feedback: '评分完毕' };
      });
      return judgments;
    };

    const result = await orchestrator.dispatchAndRace(body.task, defaultJudge);
    return c.json({
      dispatch: {
        taskId: result.dispatch.taskId,
        submitted: result.dispatch.submissions.length,
        timedOut: result.dispatch.timedOut,
      },
      race: result.race
        ? {
            rankings: result.race.rankings,
            narrative: result.race.narrative,
          }
        : null,
    });
  });

  /** Get race history */
  app.get('/race/history', (c) => {
    return c.json(orchestrator.horseRace.getHistory());
  });

  // ─── Ceremonies ───────────────────────────

  /** Trigger a court assembly */
  app.post('/ceremony/court-assembly', async (c) => {
    await orchestrator.runCourtAssembly();
    return c.json({ ok: true, message: '朝会已举行' });
  });

  /** Get ceremony history */
  app.get('/ceremony/history', (c) => {
    return c.json(orchestrator.ceremonies.getHistory());
  });

  // ─── Agent Registration ──────────────────

  /**
   * Selection ceremony: register new agents into the palace + ELO arena.
   * Also auto-registers them in openclaw.json if the workspace exists.
   */
  app.post('/ceremony/selection', async (c) => {
    const body = await c.req.json<{
      agents: Array<{
        id: string;
        name: string;
        role?: string;
        rank?: number;
      }>;
      openclawDir?: string;
    }>();

    // Validate input
    const agentErr = validateAgentInputs(body.agents);
    if (agentErr) return c.json({ error: agentErr }, 400);

    // Convert to AgentDefinition format expected by conductSelection
    const agentDefs: AgentDefinition[] = body.agents.map(a => ({
      id: a.id,
      name: a.name,
      role: { title: a.role ?? '答应', duties: [], permissions: [] },
      rank: a.rank ?? 10,
    }));

    const result = await orchestrator.ceremonies.conductSelection(agentDefs);

    // Register selected agents in ELO arena
    const selectedIds = result.outcomes
      .filter(o => o.action === 'selected')
      .map(o => o.agentId);
    for (const agentId of selectedIds) {
      orchestrator.arena.register(agentId, 1000);
    }

    return c.json({
      ok: true,
      selected: selectedIds,
      failed: result.outcomes
        .filter(o => o.action === 'selection_failed')
        .map(o => ({ agentId: o.agentId, reason: o.details.reason })),
      narrative: result.narrative,
    });
  });

  /**
   * Register agents in openclaw.json without going through the full deploy pipeline.
   * Useful for adding existing agents to OpenClaw.
   */
  app.post('/agents/register', async (c) => {
    const body = await c.req.json<{
      agents: Array<{ id: string; name: string }>;
      openclawDir?: string;
    }>();

    const universe = orchestrator.universe.config;
    // Build a minimal universe config with just the agents to register
    const miniConfig = {
      ...universe,
      agents: body.agents.map(a => ({
        id: a.id,
        name: a.name,
        role: { title: '答应', duties: [] as string[], permissions: [] as string[] },
        rank: 10,
      })),
    };

    const registered = registerAgentsInOpenClaw(miniConfig, body.openclawDir);
    return c.json({ ok: true, registered });
  });

  // ─── Dynamics ─────────────────────────────

  /** Get factions */
  app.get('/factions', (c) => {
    return c.json(orchestrator.dynamics.getFactions());
  });

  /** Form an alliance */
  app.post('/alliance', async (c) => {
    const { agent1, agent2, reason } = await c.req.json<{
      agent1: string;
      agent2: string;
      reason: string;
    }>();
    const err = validateRequired({ agent1, agent2, reason } as Record<string, unknown>, ['agent1', 'agent2', 'reason']);
    if (err) return c.json({ error: err }, 400);
    const success = orchestrator.dynamics.formAlliance(agent1, agent2, reason);
    return c.json({ ok: success });
  });

  // ─── Cold Palace ──────────────────────────

  /** Get cold palace inmates */
  app.get('/cold-palace', (c) => {
    return c.json(orchestrator.coldPalace.getInmates());
  });

  /** Banish an agent */
  app.post('/cold-palace/banish', async (c) => {
    const { agentId, reason, durationMs } = await c.req.json<{
      agentId: string;
      reason: string;
      durationMs?: number;
    }>();
    const err = validateRequired({ agentId, reason } as Record<string, unknown>, ['agentId', 'reason']);
    if (err) return c.json({ error: err }, 400);
    const success = await orchestrator.coldPalace.banish(agentId, reason, durationMs);
    return c.json({ ok: success });
  });

  /** Rehabilitate an agent */
  app.post('/cold-palace/rehabilitate', async (c) => {
    const { agentId } = await c.req.json<{ agentId: string }>();
    if (!agentId) return c.json({ error: '缺少必填字段: agentId' }, 400);
    const success = await orchestrator.coldPalace.rehabilitate(agentId);
    return c.json({ ok: success });
  });

  // ─── Resources ────────────────────────────

  /** Get resource summary for an agent */
  app.get('/resources/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    return c.json(orchestrator.resources.getResourceSummary(agentId));
  });

  /** Grant favor */
  app.post('/resources/favor', async (c) => {
    const { agentId, amount, reason } = await c.req.json<{
      agentId: string;
      amount: number;
      reason: string;
    }>();
    const err = validateRequired({ agentId, amount, reason } as Record<string, unknown>, ['agentId', 'amount', 'reason']);
    if (err) return c.json({ error: err }, 400);
    if (typeof amount !== 'number' || amount <= 0) {
      return c.json({ error: 'amount 必须是正数' }, 400);
    }
    const success = orchestrator.resources.grantFavor(agentId, amount, reason);
    return c.json({ ok: success });
  });

  // ─── Season ───────────────────────────────

  /** Start a new season */
  app.post('/season/start', (c) => {
    const season = orchestrator.seasonEngine.startSeason();
    return c.json(season);
  });

  /** Get all seasons */
  app.get('/season', (c) => {
    return c.json(orchestrator.seasonEngine.getSeasons());
  });

  return app;
}
