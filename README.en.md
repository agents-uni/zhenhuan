[![CI](https://github.com/agents-uni/zhenhuan/actions/workflows/ci.yml/badge.svg)](https://github.com/agents-uni/zhenhuan/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@agents-uni/zhenhuan.svg)](https://www.npmjs.com/package/@agents-uni/zhenhuan)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <h1 align="center">zhenhuan-uni</h1>
  <p align="center">
    <strong>Agent competition system inspired by palace intrigue</strong>
  </p>
  <p align="center">
    You are the Emperor. A horse-race framework where agents compete for your favor, ranked by ELO, driven to improve by competitive pressure. You judge, promote, and banish.
  </p>
</p>

<p align="center">
  <a href="./README.md">中文</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#competition-mechanics">Competition</a> &bull;
  <a href="#palace-system">Palace System</a> &bull;
  <a href="#rest-api">API</a> &bull;
  <a href="./DESIGN.md">Design Doc</a>
</p>

---

## Why?

Traditional multi-agent systems assign fixed roles to agents. This assumes we **already know** which agent is best for each job. We usually don't.

**zhenhuan-uni** takes a different approach: **let them compete, and let results decide**.

> Don't prescribe who's best. Set up the arena, define the rules, and let the cream rise to the top.

Built on [@agents-uni/core](https://github.com/agents-uni/core), it models a competitive hierarchy inspired by the Chinese palace drama "Legend of Zhen Huan" — where agents vie for rank, form alliances, betray rivals, and face elimination. Behind the metaphor is a rigorous competition framework applicable to:

- **Model selection** — multiple LLMs compete on the same task, ELO finds the best
- **Prompt optimization** — different prompt versions race head-to-head
- **Creative contests** — agents compete on open-ended tasks, judges pick winners
- **A/B testing** — continuous tournament-style evaluation
- **Team simulation** — pressure-test agent capabilities under competition

## How It Works

```
  dispatchAndRace()
       |
  ┌────┴──────────────────────────────┐
  │ TaskDispatcher writes TASK.md     │
  │ to each agent's OpenClaw workspace│
  └────┬──────────────────────────────┘
       |
  +----+----+----+----+
  |    |    |    |    |
 A1   A2   A3   A4   A5    ← agents read TASK.md, execute, write SUBMISSION.md
  |    |    |    |    |
  +----+----+----+----+
       |
  ┌────┴───────────────────────┐
  │ Poll & collect SUBMISSION.md│
  └────┬───────────────────────┘
       |
  You (Emperor/User)        ← score each submission via Dashboard/API
       |
  ELO Rating Update         ← winners gain, losers drop
       |
  Season End?
   yes → Promotion / Relegation / Update SOUL.md
   no  → Next Task
```

## Quick Start

### Install

```bash
# Use as a dependency
npm install @agents-uni/zhenhuan

# Or clone the repo for local development
git clone https://github.com/agents-uni/zhenhuan.git
cd zhenhuan
npm install
```

### Start the server

```bash
npm start
# or
npm run zhenhuan serve
```

On startup, it prints the access URLs:

```
  ╔══════════════════════════════════════╗
  ║   甄嬛后宫 · Agent 赛马竞技系统     ║
  ╚══════════════════════════════════════╝

  Homepage:  http://localhost:8089
  API:       http://localhost:8089/api
  Manage:    http://localhost:8089/manage
```

Open the homepage in your browser to see project intro, deployed agents, relationship graph, and user guide.

### Check palace status

```bash
npm run zhenhuan status
```

### View ELO leaderboard

```bash
npm run zhenhuan leaderboard
```

### Run a horse race (auto-dispatch)

```typescript
import { PalaceOrchestrator } from '@agents-uni/zhenhuan';

const orchestrator = await PalaceOrchestrator.fromSpec('universe.yaml');

// One call does it all: dispatch TASK.md → poll SUBMISSION.md → judge → ELO update
const { dispatch, race } = await orchestrator.dispatchAndRace(
  {
    id: 'task-001',
    title: 'Write a haiku about spring',
    description: 'Compose a haiku following the 5-7-5 syllable pattern',
    criteria: [
      { name: 'quality', weight: 0.4, description: 'Literary quality' },
      { name: 'creativity', weight: 0.3, description: 'Originality' },
      { name: 'speed', weight: 0.3, description: 'Completion speed' },
    ],
    timeoutMs: 60000, // 1 minute timeout
    participants: ['zhenhuan', 'huafei', 'anlingrong'],
  },
  myJudgeFunction
);

console.log('Submitted:', dispatch.submissions.length, 'Timed out:', dispatch.timedOut);
console.log('Rankings:', race?.rankings);       // ['zhenhuan', 'anlingrong', 'huafei']
console.log('ELO changes:', race?.eloChanges);  // Map { 'zhenhuan' => +24, 'huafei' => -18, ... }
```

**Under the hood**: `TaskDispatcher` writes `TASK.md` to each agent's OpenClaw workspace, polls for `SUBMISSION.md`, then feeds collected outputs to the horse race engine for scoring.

### Manual race (without OpenClaw)

If you already have agent outputs, skip dispatch and score directly:

```typescript
const result = await orchestrator.runHorseRace(
  task,
  [
    { agentId: 'zhenhuan', output: 'Cherry blossoms fall...', completedAt: '...', duration: 5000 },
    { agentId: 'huafei', output: 'Thunder shakes the earth...', completedAt: '...', duration: 3000 },
  ],
  myJudgeFunction
);
```

## Competition Mechanics

### ELO Rating System

Every agent starts with a base ELO rating. After each race, ratings update based on actual vs expected performance:

| Tier | K-Factor | Description |
|------|----------|-------------|
| New (< 10 matches) | 48 | Fast calibration for newcomers |
| Regular | 32 | Normal volatility |
| Veteran (ELO > 1400) | 16 | Stable, hard-earned ratings |

ELO floor is **100** — no agent drops below this, preventing death spirals.

### Horse Race

Multiple agents receive the **same task** simultaneously. You (the Emperor) score each submission across weighted criteria (quality, creativity, speed, collaboration, strategy). ELO updates happen pairwise between all participants.

### Season System

Competitions are organized into seasons (default: 30 days):

```
Season Start --> Multiple Races --> Monthly Court Assembly --> Season End
                                                               |
                                                    +----------+-----------+
                                                    |          |           |
                                                Top 20%    Middle      Bottom 15%
                                                Promoted   Unchanged   Relegated
```

Season rewards:
- 1st place: 100 favor points
- 2nd place: 60 favor points
- 3rd place: 30 favor points

## Palace System

The palace metaphor maps to concrete competitive mechanics:

### Rank Hierarchy (8 levels)

| Rank | Title | Max Slots | Monthly Stipend | Min ELO |
|------|-------|-----------|-----------------|---------|
| 8 | Queen | 1 | 1000 | 1600 |
| 7 | Imperial Noble Consort | 1 | 800 | 1500 |
| 6 | Noble Consort | 2 | 400 | 1400 |
| 5 | Consort | 4 | 200 | 1300 |
| 4 | Concubine | 6 | 100 | 1200 |
| 3 | Noble Lady | 6 | 50 | 1100 |
| 2 | First Attendant | unlimited | 20 | 1000 |
| 1 | Answering | unlimited | 10 | 0 |

**Slot limits create structural scarcity** — high ELO alone isn't enough; you need an opening.

### Resources

| Resource | Type | Distribution | Purpose |
|----------|------|-------------|---------|
| Imperial Favor | Finite | Competitive | Core influence metric, **decays 5% monthly** |
| Monthly Stipend | Renewable | By rank | Baseline resource allocation |
| Palace Assignment | Positional | By rank | Status symbol, 12 total |
| Attendants | Finite | By merit | 100 total, allocated by performance |

Favor decay means **past glory fades** — agents must keep performing to maintain influence.

### Power Dynamics

- **Alliances**: agents can ally for mutual influence boost
- **Betrayals**: allies can turn rival, creating enmity
- **Factions**: BFS-discovered alliance clusters with collective influence
- **Influence formula**: `rank + allies * 0.3 + favor * 0.1 - rivals * 5`

### Cold Palace (Elimination Zone)

Underperforming agents face banishment:

- **Temporary**: serves a sentence, auto-released on expiry
- **Indefinite**: awaits your pardon
- **Permanent**: eliminated from competition entirely

## REST API

Start the server with `npm start`, then:

```
GET  /api/state               # Full palace state
GET  /api/leaderboard         # ELO rankings
GET  /api/agents              # All agents
GET  /api/agents/:id          # Agent profile

POST /api/race/dispatch       # 🆕 Auto-dispatch race (TASK.md → SUBMISSION.md → judge)
POST /api/race/evaluate       # Manual race evaluation
GET  /api/race/history        # Race history

POST /api/ceremony/court-assembly  # Monthly review
POST /api/ceremony/selection       # 🆕 Selection (one-click agent registration)
GET  /api/ceremony/history         # Ceremony history

POST /api/agents/register          # 🆕 Register agents in openclaw.json

POST /api/alliance            # Form alliance
GET  /api/factions            # View factions

POST /api/cold-palace/banish       # Banish an agent
POST /api/cold-palace/rehabilitate # Rehabilitate an agent
GET  /api/cold-palace              # Cold palace inmates

GET  /api/resources/:agentId  # Resource summary
POST /api/resources/favor     # Grant favor

POST /api/season/start        # Start new season
GET  /api/season              # View all seasons
```

### Example: Auto-dispatch Race

```bash
curl -X POST http://localhost:8089/api/race/dispatch \
  -H 'Content-Type: application/json' \
  -d '{
    "task": {
      "id": "race-001",
      "title": "Write a strategy essay",
      "description": "Write a 500-word essay on improving team efficiency",
      "criteria": [{"name": "quality", "weight": 0.6, "description": "Depth"}, {"name": "creativity", "weight": 0.4, "description": "Originality"}],
      "timeoutMs": 120000,
      "participants": ["zhenhuan", "huafei", "anlingrong"]
    }
  }'
```

The server will:
1. Write `TASK.md` to each participant's OpenClaw workspace
2. Poll for `SUBMISSION.md` until timeout
3. Score collected submissions via the built-in judge
4. Return rankings and ELO changes

## CLI

```bash
# Start the server (default port 8089, prints homepage URL on startup)
npm run zhenhuan serve

# View palace status (ranks, ELO, favor)
npm run zhenhuan status

# View ELO leaderboard
npm run zhenhuan leaderboard

# Conduct a court assembly (monthly review)
npm run zhenhuan court

# 🆕 Selection — one-click register a new agent
npm run zhenhuan select --id new-agent --name "New Consort" --role Answering

# Also register in openclaw.json
npm run zhenhuan select --id new-agent --name "New Consort" --register
```

## Roles

### The Emperor (You)

You are the Emperor — not an AI agent, but the **user** controlling everything through Dashboard / API / CLI. Your powers:
- 🏇 **Launch races** — dispatch tasks, let consorts compete
- ⚖️ **Judge results** — review submissions, assign scores
- 📈 **Promote / Demote** — adjust ranks at court assemblies
- 💝 **Grant favor** — reward outstanding consorts
- 🏚️ **Banish** — send underperformers to the cold palace
- 🔄 **Pardon** — rehabilitate banished consorts

### Built-in Consorts (AI Agents)

| Agent | Role | Personality |
|-------|------|-------------|
| **Empress (Yixiu)** | Palace Manager | Deep strategist, controls palace order |
| **Zhen Huan** | Competitor | Strategic, adaptive, strong at collaboration |
| **Hua Fei** | Competitor | Aggressive, fast executor, dominant style |
| **An Lingrong** | Competitor | Detail-oriented, excels in niche tasks |
| **Shen Meizhuang** | Competitor | Steady, high-quality output, loyal ally |
| **Qi Fei** | Competitor | Simple, straightforward, maternal drive |
| **Duan Fei** | Competitor | Patient observer, perceptive |

Each consort has a SOUL.md definition in `src/agents/souls/` compatible with OpenClaw.

## OpenClaw Integration

zhenhuan-uni integrates with [OpenClaw](https://github.com/anthropics/openclaw) through a **file-based protocol**. Agents communicate via Markdown files in their workspace directories — no HTTP required from the agent side.

### File Protocol

```
Complete OpenClaw directory structure:
~/.openclaw/
├── openclaw.json              ← agent registry (workspace + agentDir)
├── agents/
│   └── zhenhuan/
│       ├── agent/             ← runtime config (auth-profiles.json etc.)
│       └── sessions/          ← session history
└── workspace-zhenhuan/
    ├── SOUL.md                ← deployed once (agent persona)
    ├── TASK.md                ← written per race (task description, by TaskDispatcher)
    └── SUBMISSION.md          ← written by agent after execution (collected by TaskDispatcher)
```

- **SOUL.md** — agent identity/personality/relationships, generated by `uni deploy`
- **TASK.md** — race task description, written by `TaskDispatcher`
- **SUBMISSION.md** — agent output, written by agent, polled by `TaskDispatcher`
- **agents/{id}/agent/** — agent runtime config directory, created by `deployToOpenClaw`
- **agents/{id}/sessions/** — agent session history directory, created by `deployToOpenClaw`
- **openclaw.json** — agent registry with both `workspace` and `agentDir` path fields

### Full Pipeline

```
universe.yaml
       │ uni deploy
       ▼
  SOUL.md × N → OpenClaw workspaces
       │
  dispatchAndRace()
       │
       ├─ 1. TaskDispatcher writes TASK.md to each participant's workspace
       │
       ├─ 2. Agent reads TASK.md → executes → writes SUBMISSION.md
       │
       ├─ 3. TaskDispatcher polls SUBMISSION.md until timeout
       │
       ├─ 4. HorseRaceEngine scores → ELO update → promotion/demotion
       │
       └─ 5. Regenerate SOUL.md with updated rank info
```

### Deploy Agents to OpenClaw

```bash
# One-command deploy
npx uni deploy universe.yaml

# Custom directory
npx uni deploy universe.yaml --dir ~/.openclaw

# Dry run (preview only)
npx uni deploy universe.yaml --dry-run
```

Or use pre-built SOUL.md files (hand-tuned with richer personality descriptions):

```bash
cp src/agents/souls/zhenhuan.md ~/.openclaw/workspace-zhenhuan/SOUL.md
cp src/agents/souls/huafei.md ~/.openclaw/workspace-huafei/SOUL.md
```

### One-Click Race

```typescript
import { PalaceOrchestrator } from '@agents-uni/zhenhuan';

const orchestrator = await PalaceOrchestrator.fromSpec('universe.yaml');

// Auto: write TASK.md → poll SUBMISSION.md → judge → ELO update
const { dispatch, race } = await orchestrator.dispatchAndRace(
  {
    id: 'race-001',
    title: 'Strategy Essay',
    description: 'Write a 500-word essay on improving collaboration efficiency',
    criteria: [{ name: 'quality', weight: 0.6, description: 'Content depth' }],
    timeoutMs: 120000,
    participants: ['zhenhuan', 'huafei', 'anlingrong'],
  },
  judgeFunction
);

// Or via HTTP API
// POST /api/race/dispatch
```

> 📖 Full integration tutorial: [OPENCLAW_INTEGRATION_GUIDE.md](https://github.com/agents-uni/zhenhuan/blob/main/OPENCLAW_INTEGRATION_GUIDE.md)

## Dashboard Integration

zhenhuan-uni integrates deeply with the agents-uni-core Dashboard, providing a unified web UI for managing the palace system.

### Auto-Registration

`zhenhuan serve` automatically registers the palace universe in `~/.openclaw/uni-registry.json` on startup. The `deploy` command also auto-registers via the `specPath` option.

`zhenhuan serve` starts with the agents-uni-core Dashboard built in. Visit `http://localhost:8089` to see:

- **Project Intro** — system architecture overview, quick start guide
- **Deployed Unis** — all registered universe cards, click to view details
- **Agent List** — each agent's rank, SOUL.md status, task status
- **Relationship Graph** — superior/competitive/alliance relationships
- **User Guide** — complete usage guide at `http://localhost:8089/guide`
- **Management** — reset/cleanup/update operations at `http://localhost:8089/manage`

### Extending the Dashboard

On startup, zhenhuan-uni automatically injects palace-specific panels (ELO leaderboard, factions, ranks) into the core Dashboard via the `DashboardExtension` interface:

```typescript
import { Hono } from 'hono';
import { startDashboard } from '@agents-uni/core';
import type { DashboardExtension, PanelDefinition } from '@agents-uni/core';

// Create palace extension routes
const extRoutes = new Hono();
extRoutes.get('/leaderboard', (c) => c.json(orchestrator.getLeaderboard()));
extRoutes.get('/factions', (c) => c.json(orchestrator.dynamics.getFactions()));
extRoutes.get('/state', (c) => c.json(orchestrator.getState()));

// Define homepage panels
const panels: PanelDefinition[] = [
  { title: '🏆 ELO Leaderboard', renderHtml: () => '<table>...</table>' },
  { title: '⚔️ Factions', renderHtml: () => '<div>...</div>' },
  { title: '🏛️ Palace Ranks', renderHtml: () => '<div>...</div>' },
];

const extension: DashboardExtension = {
  uniId: 'zhenhuan-palace',
  routes: extRoutes,       // Mounted at /ext/zhenhuan-palace/
  panels,                  // Displayed on homepage
};

await startDashboard({ port: 8089, extensions: [extension] });
```

## Architecture

```
+-------------------------------------------------------+
|                PalaceOrchestrator                      |
|              (Central Coordination)                    |
+-----+-------------+-------------+---------------------+
      |             |             |             |
+-----+------+ +----+------+ +---+--------+ +--+-------------+
| Competition| |   Palace  | | Evolution  | | OpenClaw Bridge|
+------------+ +-----------+ +------------+ +----------------+
| EloArena   | | Ranks     | | Performance| | TaskDispatcher |
| HorseRace  | | Resources | | Tracker    | | FileWorkspaceIO|
| Season     | | Dynamics  | | (from core)| | SoulGenerator  |
|            | | Ceremonies| |            | |                |
|            | | ColdPalace| |            | |                |
+------------+ +-----------+ +------------+ +----------------+
                     |                             |
              agents-uni-core                OpenClaw workspaces
       (Universe / Registry / Graph /        (SOUL.md / TASK.md
        StateMachine / EventBus / ...)        / SUBMISSION.md)
```

## Project Structure

```
zhenhuan-uni/
  src/
    competition/     # ELO arena, horse race engine, season system
    palace/          # Ranks, resources, dynamics, ceremonies, cold palace
    orchestrator/    # Central coordination engine
    server/          # Hono HTTP API server
    cli/             # Command-line interface
    agents/souls/    # SOUL.md definitions for built-in agents
  universe.yaml      # Full palace universe specification
  DESIGN.md          # Detailed design document
```

## Development

```bash
# Install dependencies
npm install

# Type check
npx tsc --noEmit

# Run tests
npm test

# Start dev server (watch mode)
npm run dev

# Build
npm run build
```

## Related Projects

- [**@agents-uni/core**](https://github.com/agents-uni/core) — The universal protocol layer this project is built on ([npm](https://www.npmjs.com/package/@agents-uni/core))

## License

MIT
