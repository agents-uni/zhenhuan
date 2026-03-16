/**
 * Zhen Huan Palace Server - 后宫服务器
 *
 * HTTP API server for the palace competition system.
 * Integrates agents-uni-core Dashboard as the homepage,
 * and injects palace-specific extension panels (ELO, race history, factions, etc.)
 * Uses Hono for lightweight, high-performance routing.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PalaceOrchestrator } from '../orchestrator/index.js';
import { createRoutes } from './routes/index.js';
import { createDashboardRoutes } from '@agents-uni/core';
import type { DashboardExtension, PanelDefinition } from '@agents-uni/core';

export interface ServerConfig {
  port: number;
  specPath: string;
  openclawDir?: string;
}

/**
 * Build palace-specific extension panels for the core Dashboard homepage.
 * These show live ELO leaderboard, recent race results, and faction map
 * directly on the dashboard — no need to call raw API.
 */
function buildPalaceExtension(orchestrator: PalaceOrchestrator): DashboardExtension {
  const extRoutes = new Hono();

  // Extension API: live ELO leaderboard as JSON
  extRoutes.get('/leaderboard', (c) => c.json(orchestrator.getLeaderboard()));
  extRoutes.get('/factions', (c) => c.json(orchestrator.dynamics.getFactions()));
  extRoutes.get('/state', (c) => c.json(orchestrator.getState()));

  const panels: PanelDefinition[] = [
    {
      title: '🏆 ELO 排行榜',
      renderHtml: () => {
        const board = orchestrator.getLeaderboard();
        if (board.length === 0) {
          return '<p class="text-gray-500 text-sm">暂无排名数据。先运行一次赛马吧！</p>';
        }
        const rows = board.slice(0, 8).map((r, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span class="text-gray-500 w-5 inline-block text-center">${i + 1}</span>`;
          const winRate = r.matchCount > 0 ? Math.round(r.winCount / r.matchCount * 100) + '%' : '-';
          return `<tr class="border-b border-gray-700/30">
            <td class="py-1.5 px-2">${medal}</td>
            <td class="py-1.5 px-2 text-white font-medium">${escapeHtml(r.agentId)}</td>
            <td class="py-1.5 px-2 text-yellow-400 text-right">${r.rating}</td>
            <td class="py-1.5 px-2 text-gray-400 text-right">${r.winCount}W ${r.lossCount}L</td>
            <td class="py-1.5 px-2 text-gray-500 text-right">${winRate}</td>
          </tr>`;
        }).join('');
        return `<table class="w-full text-sm">
          <thead><tr class="text-gray-500 text-xs">
            <th class="px-2 py-1 text-left w-8"></th>
            <th class="px-2 py-1 text-left">Agent</th>
            <th class="px-2 py-1 text-right">ELO</th>
            <th class="px-2 py-1 text-right">战绩</th>
            <th class="px-2 py-1 text-right">胜率</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      },
    },
    {
      title: '⚔️ 势力格局',
      renderHtml: () => {
        const factions = orchestrator.dynamics.getFactions();
        if (factions.length === 0) {
          return '<p class="text-gray-500 text-sm">暂无势力数据。Agent 结盟后会在此显示。</p>';
        }
        return factions.map(f => `
          <div class="flex items-center gap-3 py-2 border-b border-gray-700/30 last:border-0">
            <span class="text-white font-medium">${escapeHtml(f.leader)}</span>
            <span class="text-gray-500">派系</span>
            <span class="text-gray-300 text-sm">${f.members.map((m: string) => escapeHtml(m)).join(', ')}</span>
            <span class="ml-auto badge bg-accent/20 text-accent-light">影响力 ${f.influence}</span>
          </div>
        `).join('');
      },
    },
    {
      title: '🏛️ 后宫品级',
      renderHtml: () => {
        const state = orchestrator.getState();
        const sorted = [...state.agents].sort((a, b) => b.rankLevel - a.rankLevel);
        if (sorted.length === 0) {
          return '<p class="text-gray-500 text-sm">暂无 Agent 数据。</p>';
        }
        return `<div class="space-y-1.5">${sorted.map(a => {
          const isActive = a.status === 'active' || a.status === 'idle';
          return `<div class="flex items-center gap-2 text-sm">
            <span class="${isActive ? 'text-green-400' : 'text-red-400'}">●</span>
            <span class="text-white font-medium w-20 truncate">${escapeHtml(a.name)}</span>
            <span class="text-cyan-400 w-12">${escapeHtml(a.rank)}</span>
            <span class="text-yellow-400 text-xs">ELO ${a.elo}</span>
            <span class="ml-auto text-purple-400 text-xs">圣宠 ${a.favor}</span>
          </div>`;
        }).join('')}</div>`;
      },
    },
  ];

  // Add cold palace panel if there are inmates
  const coldPalaceInmates = orchestrator.coldPalace.getInmates();
  if (coldPalaceInmates.length > 0) {
    panels.push({
      title: '🏚️ 冷宫',
      renderHtml: () => {
        return coldPalaceInmates.map(inmate => `
          <div class="flex items-center gap-2 py-1.5 text-sm border-b border-gray-700/30 last:border-0">
            <span class="text-gray-500">○</span>
            <span class="text-gray-400">${escapeHtml(inmate.name ?? inmate.agentId)}</span>
            <span class="ml-auto text-gray-600 text-xs">${escapeHtml(inmate.reason)}</span>
          </div>
        `).join('');
      },
    });
  }

  return {
    uniId: 'zhenhuan-palace',
    routes: extRoutes,
    panels,
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export async function startServer(config: ServerConfig): Promise<void> {
  const { port, specPath } = config;

  // ─── Validate spec file exists ──────────────────
  const resolvedSpec = resolve(specPath);
  if (!existsSync(resolvedSpec)) {
    console.error('');
    console.error('  \x1b[31m✗ 找不到规范文件:\x1b[0m ' + resolvedSpec);
    console.error('');
    console.error('  \x1b[90m请先创建 universe.yaml，或指定路径:\x1b[0m');
    console.error('    npm run zhenhuan serve -- --spec /path/to/universe.yaml');
    console.error('');
    console.error('  \x1b[90m或使用脚手架生成:\x1b[0m');
    console.error('    npx uni init');
    console.error('');
    process.exit(1);
  }

  // ─── Initialize orchestrator ────────────────────
  let orchestrator: PalaceOrchestrator;
  try {
    orchestrator = await PalaceOrchestrator.fromSpec(resolvedSpec);
  } catch (err) {
    console.error('');
    console.error('  \x1b[31m✗ 规范文件解析失败:\x1b[0m');
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    console.error('');
    console.error('  \x1b[90m请检查 YAML 格式是否正确。可运行:\x1b[0m');
    console.error(`    npx uni validate ${specPath}`);
    console.error('');
    process.exit(1);
  }

  // ─── Create Hono app ───────────────────────────
  const app = new Hono();

  // Middleware
  app.use('*', cors());
  app.use('*', logger());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', universe: 'zhenhuan-palace' }));

  // Mount zhenhuan-specific API routes at /api
  const api = createRoutes(orchestrator);
  app.route('/api', api);

  // Build palace extension panels for Dashboard homepage
  const palaceExtension = buildPalaceExtension(orchestrator);

  // Mount core Dashboard with palace extensions injected
  const dashboard = createDashboardRoutes({
    port,
    openclawDir: config.openclawDir,
    extensions: [palaceExtension],
  });
  app.route('/', dashboard);

  const url = `http://localhost:${port}`;

  console.log('');
  console.log('  \x1b[33m╔══════════════════════════════════════╗\x1b[0m');
  console.log('  \x1b[33m║\x1b[0m   \x1b[1m\x1b[35m甄嬛后宫 · 你是皇帝\x1b[0m              \x1b[33m║\x1b[0m');
  console.log('  \x1b[33m╚══════════════════════════════════════╝\x1b[0m');
  console.log('');
  console.log(`  \x1b[36m首页:\x1b[0m      ${url}`);
  console.log(`  \x1b[36mAPI:\x1b[0m       ${url}/api`);
  console.log(`  \x1b[36m管理:\x1b[0m      ${url}/manage`);
  console.log(`  \x1b[36m手册:\x1b[0m      ${url}/guide`);
  console.log(`  \x1b[36m规范文件:\x1b[0m   ${resolvedSpec}`);
  console.log('');
  console.log(`  \x1b[90mAgent 数: ${orchestrator.universe.config.agents.length}\x1b[0m`);
  console.log('  \x1b[90m按 Ctrl+C 停止服务\x1b[0m');
  console.log('');

  serve({ fetch: app.fetch, port });
}

// ─── Main Entry Point ──────────────────────────────
// Only start when this file is executed directly (not imported).

const isDirectExecution = process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.url.replace('file://', ''));

if (isDirectExecution) {
  const port = parseInt(process.env.PORT || '8089', 10);
  const specPath = process.env.SPEC_PATH || resolve(process.cwd(), 'universe.yaml');

  startServer({ port, specPath }).catch((err) => {
    console.error('❌ 后宫服务器启动失败:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
