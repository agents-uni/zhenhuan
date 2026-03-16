#!/usr/bin/env node

/**
 * Zhen Huan CLI - 后宫命令行工具
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { PalaceOrchestrator } from '../orchestrator/index.js';
import { startServer } from '../server/index.js';

const program = new Command();

program
  .name('zhenhuan')
  .description('甄嬛后宫 Agent 赛马系统 —— 你是皇帝，Agent 为你竞争')
  .version('0.1.0');

// ─── serve ──────────────────────────────────

program
  .command('serve')
  .description('启动后宫服务器')
  .option('-p, --port <port>', '端口号', '8089')
  .option('-s, --spec <path>', '规范文件路径', 'universe.yaml')
  .action(async (opts) => {
    // Auto-register in uni-registry on serve
    try {
      const { resolve } = await import('node:path');
      const { registerUni, parseSpecFile } = await import('@agents-uni/core');
      const specPath = resolve(opts.spec);
      const config = parseSpecFile(specPath);
      registerUni(config, specPath);
      console.log(chalk.gray(`  ✓ 已注册到 uni-registry`));
    } catch {
      // Registry registration is non-critical
    }

    await startServer({
      port: parseInt(opts.port, 10),
      specPath: opts.spec,
    });
  });

// ─── status ─────────────────────────────────

program
  .command('status')
  .description('查看后宫状态')
  .option('-s, --spec <path>', '规范文件路径', 'universe.yaml')
  .action(async (opts) => {
    const orchestrator = await PalaceOrchestrator.fromSpec(opts.spec);

    const state = orchestrator.getState();

    console.log(chalk.yellow('\n═══ 后宫品级表 ═══\n'));

    // Sort by rank level descending
    const sorted = [...state.agents].sort((a, b) => b.rankLevel - a.rankLevel);

    for (const agent of sorted) {
      const statusIcon = agent.status === 'active' || agent.status === 'idle' ? '●' : '○';
      const statusColor = agent.status === 'active' || agent.status === 'idle' ? chalk.green : chalk.red;

      console.log(
        `  ${statusColor(statusIcon)} ${chalk.bold(agent.name.padEnd(10))} ` +
        `${chalk.cyan(agent.rank.padEnd(6))} ` +
        `ELO: ${chalk.yellow(String(agent.elo).padStart(4))}  ` +
        `圣宠: ${chalk.magenta(String(agent.favor).padStart(3))}`
      );
    }

    if (state.factions.length > 0) {
      console.log(chalk.yellow('\n═══ 势力格局 ═══\n'));
      for (const faction of state.factions) {
        console.log(
          `  ${chalk.bold(faction.leader)} 派系: ` +
          `${faction.members.join(', ')} ` +
          `(影响力: ${chalk.cyan(String(faction.influence))})`
        );
      }
    }

    if (state.coldPalaceInmates.length > 0) {
      console.log(chalk.yellow('\n═══ 冷宫 ═══\n'));
      for (const inmate of state.coldPalaceInmates) {
        console.log(`  ${chalk.gray('○')} ${inmate}`);
      }
    }

    console.log();
  });

// ─── leaderboard ────────────────────────────

program
  .command('leaderboard')
  .description('查看 ELO 排行榜')
  .option('-s, --spec <path>', '规范文件路径', 'universe.yaml')
  .action(async (opts) => {
    const orchestrator = await PalaceOrchestrator.fromSpec(opts.spec);

    const board = orchestrator.getLeaderboard();

    console.log(chalk.yellow('\n═══ ELO 排行榜 ═══\n'));
    console.log(
      `  ${chalk.gray('排名')}  ${chalk.gray('ID'.padEnd(16))} ` +
      `${chalk.gray('ELO'.padStart(5))}  ${chalk.gray('胜'.padStart(3))} ` +
      `${chalk.gray('负'.padStart(3))}  ${chalk.gray('胜率'.padStart(5))}`
    );
    console.log(chalk.gray('  ─'.repeat(20)));

    board.forEach((record, index) => {
      const winRate = record.matchCount > 0
        ? (record.winCount / record.matchCount * 100).toFixed(0) + '%'
        : '  -';

      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';

      console.log(
        `  ${medal} ${chalk.bold(record.agentId.padEnd(16))} ` +
        `${chalk.yellow(String(record.rating).padStart(5))}  ` +
        `${chalk.green(String(record.winCount).padStart(3))} ` +
        `${chalk.red(String(record.lossCount).padStart(3))}  ` +
        `${winRate.padStart(5)}`
      );
    });
    console.log();
  });

// ─── court ──────────────────────────────────

program
  .command('court')
  .description('召开朝会')
  .option('-s, --spec <path>', '规范文件路径', 'universe.yaml')
  .action(async (opts) => {
    const orchestrator = await PalaceOrchestrator.fromSpec(opts.spec);

    console.log(chalk.yellow('\n═══ 朝会开始 ═══\n'));

    await orchestrator.runCourtAssembly();

    const state = orchestrator.getState();
    for (const event of state.recentEvents.slice(-5)) {
      console.log(`  ${chalk.gray(event.timestamp.slice(0, 19))} ${event.description}`);
    }

    console.log(chalk.yellow('\n═══ 朝会结束 ═══\n'));
  });

// ─── select ────────────────────────────

program
  .command('select')
  .description('选秀 — 一键注册新 Agent 并加入后宫竞技')
  .requiredOption('--id <id>', 'Agent ID')
  .requiredOption('--name <name>', 'Agent 名称')
  .option('--role <role>', '初始品级', '答应')
  .option('--rank <rank>', '品级数值 (10=答应, 20=常在, ...)', '10')
  .option('--register', '同时注册到 openclaw.json', false)
  .option('--openclaw-dir <dir>', 'OpenClaw 目录', '')
  .option('-s, --spec <path>', '规范文件路径', 'universe.yaml')
  .action(async (opts) => {
    const orchestrator = await PalaceOrchestrator.fromSpec(opts.spec);

    const agentDef = {
      id: opts.id as string,
      name: opts.name as string,
      role: { title: opts.role as string, duties: [] as string[], permissions: [] as string[] },
      rank: parseInt(opts.rank, 10),
    };

    console.log(chalk.yellow('\n═══ 选秀大典 ═══\n'));
    console.log(`  候选: ${chalk.bold(agentDef.name)} (${chalk.cyan(agentDef.id)})`);
    console.log(`  品级: ${chalk.cyan(agentDef.role.title)}`);

    const result = await orchestrator.ceremonies.conductSelection([agentDef]);

    const selected = result.outcomes.filter(o => o.action === 'selected');
    const failed = result.outcomes.filter(o => o.action === 'selection_failed');

    if (selected.length > 0) {
      // Register in ELO arena
      orchestrator.arena.register(agentDef.id, 1000);
      console.log(chalk.green(`\n  ✓ ${agentDef.name} 入宫成功！初始 ELO: 1000`));

      // Auto-register in openclaw.json if requested
      if (opts.register) {
        const { registerAgentsInOpenClaw } = await import('@agents-uni/core');
        const uniConfig = orchestrator.universe.config;
        const miniConfig = {
          ...uniConfig,
          agents: [agentDef],
        };
        const registered = registerAgentsInOpenClaw(miniConfig, opts.openclawDir || undefined);
        if (registered.length > 0) {
          console.log(chalk.green(`  ✓ 已注册到 openclaw.json`));
        } else {
          console.log(chalk.gray(`  - openclaw.json 中已存在或未找到配置文件`));
        }
      }
    }

    if (failed.length > 0) {
      for (const f of failed) {
        console.log(chalk.red(`\n  ✗ 选秀失败: ${f.details.reason}`));
      }
    }

    console.log(chalk.gray(`\n  ${result.narrative}`));
    console.log();
  });

// ─── race ───────────────────────────────────

program
  .command('race')
  .description('发起赛马竞技 — 下发任务到 OpenClaw 工作区，收集产出并评判')
  .requiredOption('-t, --task <title>', '赛马任务标题')
  .option('-d, --description <desc>', '任务描述', '')
  .option('--timeout <ms>', '超时时间（毫秒）', '60000')
  .option('-s, --spec <path>', '规范文件路径', 'universe.yaml')
  .option('--agents <ids>', '参赛 Agent ID (逗号分隔，默认全部嫔妃)', '')
  .action(async (opts) => {
    const orchestrator = await PalaceOrchestrator.fromSpec(opts.spec);

    // Determine participants: all agents by default (emperor is the user, not an agent)
    let participants: string[];
    if (opts.agents) {
      participants = opts.agents.split(',').map((s: string) => s.trim());
    } else {
      const state = orchestrator.getState();
      participants = state.agents
        .filter(a => a.rank !== '未知')
        .map(a => a.id);
    }

    if (participants.length < 2) {
      console.log(chalk.red('\n  ✗ 至少需要 2 名参赛者\n'));
      process.exit(1);
    }

    const taskId = `race-${Date.now()}`;
    const timeoutMs = parseInt(opts.timeout, 10);

    console.log(chalk.yellow('\n═══ 赛马开始 ═══\n'));
    console.log(`  任务: ${chalk.bold(opts.task)}`);
    console.log(`  参赛: ${chalk.cyan(participants.join(', '))}`);
    console.log(`  超时: ${chalk.gray(timeoutMs / 1000 + 's')}`);
    console.log(`  任务文件已下发到各 OpenClaw workspace 的 TASK.md`);
    console.log(chalk.gray('\n  等待各 Agent 提交 SUBMISSION.md ...\n'));

    const { dispatch, race } = await orchestrator.dispatchAndRace(
      {
        id: taskId,
        title: opts.task,
        description: opts.description || opts.task,
        criteria: [
          { name: '质量', weight: 0.5, description: '输出质量和完整度' },
          { name: '创意', weight: 0.3, description: '创新性和独特视角' },
          { name: '速度', weight: 0.2, description: '完成速度' },
        ],
        timeoutMs,
        participants,
      },
      // Default judge (placeholder — in production, call LLM)
      async (task, entries) => {
        return entries.map(entry => {
          const criterionScores = new Map<string, number>();
          for (const criterion of task.criteria) {
            criterionScores.set(criterion.name, 50 + Math.random() * 50);
          }
          let totalScore = 0;
          let totalWeight = 0;
          for (const criterion of task.criteria) {
            totalScore += (criterionScores.get(criterion.name) ?? 50) * criterion.weight;
            totalWeight += criterion.weight;
          }
          if (totalWeight > 0) totalScore /= totalWeight;
          return { agentId: entry.agentId, criterionScores, totalScore, feedback: '评分完毕' };
        });
      }
    );

    // Report dispatch results
    console.log(chalk.green(`  ✓ 收到 ${dispatch.submissions.length} 份提交`));
    if (dispatch.timedOut.length > 0) {
      console.log(chalk.red(`  ✗ 超时未提交: ${dispatch.timedOut.join(', ')}`));
    }

    // Report race results
    if (race) {
      console.log(chalk.yellow('\n═══ 赛马结果 ═══\n'));
      race.rankings.forEach((agentId, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        const judgment = race.judgments.find(j => j.agentId === agentId);
        const score = judgment ? judgment.totalScore.toFixed(1) : '-';
        const eloChange = race.eloChanges.get(agentId) ?? 0;
        const eloStr = eloChange >= 0 ? chalk.green(`+${eloChange}`) : chalk.red(`${eloChange}`);
        console.log(`  ${medal} ${chalk.bold(agentId.padEnd(16))} 得分: ${chalk.yellow(score)}  ELO: ${eloStr}`);
      });
    } else {
      console.log(chalk.gray('\n  提交不足 2 份，无法进行评判\n'));
    }

    console.log();
  });

program.parse();
