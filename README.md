[![CI](https://github.com/agents-uni/zhenhuan/actions/workflows/ci.yml/badge.svg)](https://github.com/agents-uni/zhenhuan/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@agents-uni/zhenhuan.svg)](https://www.npmjs.com/package/@agents-uni/zhenhuan)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <h1 align="center">zhenhuan-uni</h1>
  <p align="center">
    <strong>甄嬛后宫 Agent 赛马竞技系统</strong>
  </p>
  <p align="center">
    你是皇帝，让嫔妃们（Agent）在同一任务上竞争，用 ELO 排名筛选最优者，通过竞争压力驱动持续进化。
  </p>
</p>

<p align="center">
  <a href="./README.en.md">English</a> &bull;
  <a href="#工作原理">工作原理</a> &bull;
  <a href="#快速开始">快速开始</a> &bull;
  <a href="#竞争机制">竞争机制</a> &bull;
  <a href="#后宫体系">后宫体系</a> &bull;
  <a href="#rest-api">API</a> &bull;
  <a href="./DESIGN.md">设计文档</a>
</p>

---

## 为什么需要这个项目？

传统多 Agent 系统给每个 Agent 分配固定角色，这假设我们**已经知道**哪个 Agent 最擅长什么。但通常我们并不知道。

**zhenhuan-uni** 采取不同策略：**让它们竞争，让结果说话**。

> 不预设谁是最优，搭好擂台、定好规则，让强者自然浮现。

基于 [@agents-uni/core](https://github.com/agents-uni/core) 构建，以甄嬛传后宫为隐喻 —— Agent 们争夺品级、结盟、背叛、面临淘汰。隐喻背后是一套严谨的竞争框架，适用于：

- **模型选择** —— 多个 LLM 模型同时答题，ELO 自动选出最优
- **Prompt 优化** —— 不同 prompt 版本直接对决
- **创意竞赛** —— 开放式任务多人竞标，评审选出最佳
- **A/B 测试** —— 基于锦标赛的持续评估框架
- **团队模拟** —— 在竞争压力下测试 Agent 极限能力

## 工作原理

```
  dispatchAndRace()
       |
  ┌────┴────────────────────────────┐
  │ TaskDispatcher 写 TASK.md       │
  │ 到每个 Agent 的 OpenClaw 工作区 │
  └────┬────────────────────────────┘
       |
  +----+----+----+----+
  |    |    |    |    |
 A1   A2   A3   A4   A5    ← 各 Agent 读取 TASK.md，执行后写 SUBMISSION.md
  |    |    |    |    |
  +----+----+----+----+
       |
  ┌────┴────────────────────┐
  │ 轮询收集 SUBMISSION.md  │
  └────┬────────────────────┘
       |
  你（皇帝/用户）评审   ← 通过 Dashboard/API 打分
       |
  ELO 排名更新          ← 赢者加分，输者扣分
       |
  赛季结束？
   是 → 晋升 / 降级 / 更新 SOUL.md
   否 → 下一个任务
```

## 快速开始

### 安装

```bash
# 作为依赖使用
npm install @agents-uni/zhenhuan

# 或克隆仓库本地开发
git clone https://github.com/agents-uni/zhenhuan.git
cd zhenhuan
npm install
```

### 启动服务器

```bash
npm start
# 或
npm run zhenhuan serve
```

启动后会打印访问链接：

```
  ╔══════════════════════════════════════╗
  ║   甄嬛后宫 · Agent 赛马竞技系统     ║
  ╚══════════════════════════════════════╝

  首页:      http://localhost:8089
  API:       http://localhost:8089/api
  管理:      http://localhost:8089/manage
```

浏览器访问首页即可看到项目介绍、已部署的 Agent、关系图谱、用户手册等。

### 查看后宫状态

```bash
npm run zhenhuan status
```

### 查看 ELO 排行榜

```bash
npm run zhenhuan leaderboard
```

### 编程式调用赛马（自动调度）

```typescript
import { PalaceOrchestrator } from '@agents-uni/zhenhuan';

const orchestrator = await PalaceOrchestrator.fromSpec('universe.yaml');

// 一键完成：下发任务 → 等待提交 → 评审 → ELO 更新
const { dispatch, race } = await orchestrator.dispatchAndRace(
  {
    id: 'task-001',
    title: '写一首关于春天的俳句',
    description: '按照 5-7-5 音节模式创作俳句',
    criteria: [
      { name: 'quality', weight: 0.4, description: '文学质量' },
      { name: 'creativity', weight: 0.3, description: '创意性' },
      { name: 'speed', weight: 0.3, description: '完成速度' },
    ],
    timeoutMs: 60000, // 1 分钟超时
    participants: ['zhenhuan', 'huafei', 'anlingrong'],
  },
  myJudgeFunction
);

console.log('提交:', dispatch.submissions.length, '超时:', dispatch.timedOut);
console.log('排名:', race?.rankings);       // ['zhenhuan', 'anlingrong', 'huafei']
console.log('ELO 变化:', race?.eloChanges);  // Map { 'zhenhuan' => +24, 'huafei' => -18, ... }
```

**底层流程**：`TaskDispatcher` 将 `TASK.md` 写入每个 Agent 的 OpenClaw 工作区，然后轮询 `SUBMISSION.md`，收集完成后交给赛马引擎评分。

### 手动赛马（不经过 OpenClaw）

如果你已有各 Agent 的输出，可以跳过调度直接评分：

```typescript
const result = await orchestrator.runHorseRace(
  task,
  [
    { agentId: 'zhenhuan', output: '樱花纷纷落...', completedAt: '...', duration: 5000 },
    { agentId: 'huafei', output: '春雷震大地...', completedAt: '...', duration: 3000 },
  ],
  myJudgeFunction
);
```

## 竞争机制

### ELO 积分系统

每个 Agent 有一个基础 ELO 分。每次赛马后，根据实际表现 vs 预期表现更新积分：

| 分级 | K 因子 | 说明 |
|------|--------|------|
| 新手（< 10 场） | 48 | 快速校准 |
| 常规 | 32 | 正常波动 |
| 高手（ELO > 1400） | 16 | 排名稳定 |

ELO 地板为 **100** —— 防止 Agent 陷入死亡螺旋。

### 赛马竞技（Horse Race）

多个 Agent 同时收到**完全相同的任务**，分别提交结果，由你（皇帝）按加权维度（质量、创意、速度、协作、策略）打分。ELO 在所有参与者之间成对更新。

### 赛季制度

竞争按赛季组织（默认 30 天）：

```
赛季开始 --> 多次赛马 --> 月度朝会 --> 赛季结算
                                        |
                              +---------+---------+
                              |         |         |
                           前 20%    中间层    后 15%
                            晋升      不变      降级
```

赛季奖励：
- 第 1 名：100 圣宠
- 第 2 名：60 圣宠
- 第 3 名：30 圣宠

## 后宫体系

后宫隐喻对应具体的竞争机制：

### 品级制度（8 级）

| 品级 | 名号 | 名额上限 | 月例 | 最低 ELO |
|------|------|----------|------|----------|
| 8 | 皇后 | 1 | 1000 | 1600 |
| 7 | 皇贵妃 | 1 | 800 | 1500 |
| 6 | 贵妃 | 2 | 400 | 1400 |
| 5 | 妃 | 4 | 200 | 1300 |
| 4 | 嫔 | 6 | 100 | 1200 |
| 3 | 贵人 | 6 | 50 | 1100 |
| 2 | 常在 | 不限 | 20 | 1000 |
| 1 | 答应 | 不限 | 10 | 0 |

**名额限制创造结构性稀缺** —— 光有高 ELO 不够，还需要有空缺。

### 资源体系

| 资源 | 类型 | 分配方式 | 作用 |
|------|------|----------|------|
| 圣宠 | 有限 | 竞争 | 核心影响力指标，**每月衰减 5%** |
| 月例 | 可再生 | 按品级 | 基础资源保障 |
| 宫殿 | 位置性 | 按品级 | 身份象征，共 12 座 |
| 侍女 | 有限 | 按功绩 | 共 100 名，按表现分配 |

圣宠衰减意味着**过去的辉煌会褪色** —— Agent 必须持续产出才能维持影响力。

### 势力博弈

- **结盟**：互为盟友，增加影响力
- **背叛**：盟友反目成仇，产生敌对关系
- **派系**：通过 BFS 发现的盟友连通分量
- **影响力公式**：`品级 + 盟友 * 0.3 + 圣宠 * 0.1 - 对手 * 5`

### 冷宫（淘汰区）

表现不佳的 Agent 面临放逐：

- **暂时放逐**：到期自动复出
- **无限期放逐**：等待你恩赦
- **永久除名**：彻底淘汰出局

## REST API

启动服务器后（`npm start`）：

```
GET  /api/state               # 后宫完整状态
GET  /api/leaderboard         # ELO 排行榜
GET  /api/agents              # 所有 Agent 列表
GET  /api/agents/:id          # Agent 详细档案

POST /api/race/dispatch       # 🆕 自动调度赛马（写 TASK.md → 收集 SUBMISSION.md → 评审）
POST /api/race/evaluate       # 手动提交赛马结果评审
GET  /api/race/history        # 赛马历史记录

POST /api/ceremony/court-assembly  # 召开朝会（月度评审）
POST /api/ceremony/selection       # 🆕 选秀（一键注册新 Agent）
GET  /api/ceremony/history         # 朝会历史

POST /api/agents/register          # 🆕 注册 Agent 到 openclaw.json

POST /api/alliance            # 结盟
GET  /api/factions            # 查看派系

POST /api/cold-palace/banish      # 打入冷宫
POST /api/cold-palace/rehabilitate # 恢复出宫
GET  /api/cold-palace             # 冷宫名单

GET  /api/resources/:agentId  # 资源摘要
POST /api/resources/favor     # 赏赐圣宠

POST /api/season/start        # 开启新赛季
GET  /api/season              # 查看所有赛季
```

### 示例：一键调度赛马

```bash
curl -X POST http://localhost:8089/api/race/dispatch \
  -H 'Content-Type: application/json' \
  -d '{
    "task": {
      "id": "race-001",
      "title": "撰写策论",
      "description": "就提升团队效率撰写500字策论",
      "criteria": [{"name": "质量", "weight": 0.6, "description": "内容深度"}, {"name": "创意", "weight": 0.4, "description": "创新性"}],
      "timeoutMs": 120000,
      "participants": ["zhenhuan", "huafei", "anlingrong"]
    }
  }'
```

服务器会：
1. 向每个参赛者的 OpenClaw 工作区写入 `TASK.md`
2. 轮询 `SUBMISSION.md` 直到超时
3. 收集到的提交由内置评审打分
4. 返回排名和 ELO 变化

## 命令行工具

```bash
# 启动服务器（默认端口 8089，启动后打印首页链接）
npm run zhenhuan serve

# 查看后宫状态（品级、ELO、圣宠）
npm run zhenhuan status

# 查看 ELO 排行榜
npm run zhenhuan leaderboard

# 召开朝会（月度评审）
npm run zhenhuan court

# 🆕 选秀 — 一键注册新 Agent
npm run zhenhuan select --id new-agent --name "新秀女" --role 答应

# 同时注册到 openclaw.json
npm run zhenhuan select --id new-agent --name "新秀女" --register
```

## 角色设计

### 皇帝（你）

你就是皇帝——不是 AI Agent，而是通过 Dashboard / API / CLI 操控一切的**用户本人**。你的权力包括：
- 🏇 **发起赛马** — 下发任务，让嫔妃们竞争
- ⚖️ **评判结果** — 审阅提交，裁定分数
- 📈 **晋升/贬谪** — 在朝会上调整品级
- 💝 **赏赐圣宠** — 奖赏优秀的嫔妃
- 🏚️ **打入冷宫** — 放逐表现不佳者
- 🔄 **恩赦复出** — 赦免冷宫中的嫔妃

### 内置嫔妃（AI Agent）

| Agent | 角色 | 性格特质 |
|-------|------|----------|
| **皇后·宜修** | 六宫之主 | 权谋深沉，掌控后宫秩序 |
| **甄嬛** | 选手 | 善于策略，适应性强，擅长协作 |
| **华妃·年世兰** | 选手 | 风格强势，执行力极强，攻击性高 |
| **安陵容** | 选手 | 注重细节，在特定领域表现优异 |
| **沈眉庄** | 选手 | 稳定高质量输出，忠诚的盟友 |
| **齐妃·李氏** | 选手 | 质朴直率，母性驱动 |
| **端妃** | 选手 | 耐心沉稳，暗中观察 |

每个嫔妃在 `src/agents/souls/` 下有 SOUL.md 定义文件，兼容 OpenClaw。

## OpenClaw 集成

zhenhuan-uni 通过 agents-uni-core 的桥接模块与 [OpenClaw](https://github.com/anthropics/openclaw) 无缝集成。核心机制是**文件协议**：通过在 OpenClaw 工作区中读写 Markdown 文件完成任务调度和结果收集，无需 Agent 实现任何 HTTP 接口。

### 文件协议

```
OpenClaw 完整目录结构：
~/.openclaw/
├── openclaw.json              ← Agent 注册（含 workspace + agentDir）
├── agents/
│   └── zhenhuan/
│       ├── agent/             ← 运行时配置（auth-profiles.json 等）
│       └── sessions/          ← 会话历史
└── workspace-zhenhuan/
    ├── SOUL.md                ← 部署时写入（Agent 人格定义）
    ├── TASK.md                ← 赛马时写入（任务描述，由 TaskDispatcher 生成）
    └── SUBMISSION.md          ← Agent 执行后写入（提交结果，由 Agent 自行写入）
```

- **SOUL.md** — Agent 的身份/性格/关系/权限，由 `uni deploy` 生成
- **TASK.md** — 赛马任务描述，由 `TaskDispatcher` 写入
- **SUBMISSION.md** — Agent 的提交，由 Agent 写入，`TaskDispatcher` 轮询收集
- **agents/{id}/agent/** — Agent 运行时配置目录，由 `deployToOpenClaw` 创建
- **agents/{id}/sessions/** — Agent 会话历史目录，由 `deployToOpenClaw` 创建
- **openclaw.json** — Agent 注册信息，包含 `workspace` 和 `agentDir` 两个路径字段

### 完整流程

```
universe.yaml
       │ uni deploy
       ▼
  SOUL.md × N → 各 OpenClaw 工作区
       │
  dispatchAndRace()
       │
       ├─ 1. TaskDispatcher 写 TASK.md 到每个参赛者工作区
       │
       ├─ 2. Agent 读取 TASK.md → 执行 → 写 SUBMISSION.md
       │
       ├─ 3. TaskDispatcher 轮询 SUBMISSION.md 直到超时
       │
       ├─ 4. HorseRaceEngine 评审 → ELO 更新 → 晋升/降级
       │
       └─ 5. 重新生成 SOUL.md → 更新品级信息
```

### 部署 Agent 到 OpenClaw

```bash
# CLI 一键部署
npx uni deploy universe.yaml

# 指定目录
npx uni deploy universe.yaml --dir ~/.openclaw

# 预览（不实际写入）
npx uni deploy universe.yaml --dry-run
```

或使用预置 SOUL.md（手工调优版，包含更丰富的性格描写）：

```bash
cp src/agents/souls/zhenhuan.md ~/.openclaw/workspace-zhenhuan/SOUL.md
cp src/agents/souls/huafei.md ~/.openclaw/workspace-huafei/SOUL.md
```

### 一键赛马

```typescript
import { PalaceOrchestrator } from '@agents-uni/zhenhuan';

const orchestrator = await PalaceOrchestrator.fromSpec('universe.yaml');

// 自动：写 TASK.md → 轮询 SUBMISSION.md → 评审 → ELO 更新
const { dispatch, race } = await orchestrator.dispatchAndRace(
  {
    id: 'race-001',
    title: '撰写策论',
    description: '就"如何提升协作效率"撰写500字策论',
    criteria: [{ name: '质量', weight: 0.6, description: '内容深度' }],
    timeoutMs: 120000,
    participants: ['zhenhuan', 'huafei', 'anlingrong'],
  },
  judgeFunction
);

// 或通过 HTTP API
// POST /api/race/dispatch
```

> 📖 详细整合教程见 [OPENCLAW_INTEGRATION_GUIDE.md](https://github.com/agents-uni/zhenhuan/blob/main/OPENCLAW_INTEGRATION_GUIDE.md)

## Dashboard 集成

zhenhuan-uni 内置了 agents-uni-core 的 Dashboard，启动服务后直接访问首页即可。

### 首页功能

`zhenhuan serve` 启动后，访问 `http://localhost:8089` 可以看到：

- **项目介绍** — 系统架构概览、快速上手指南
- **已部署 Uni** — 所有已注册的 Universe 卡片，点击进入详情
- **Agent 列表** — 每个 Agent 的品级、SOUL.md 状态、任务状态
- **关系图谱** — Agent 之间的上下级、竞争、联盟关系
- **用户手册** — 完整使用指南，访问 `http://localhost:8089/guide`
- **管理中心** — 重置/清理/更新操作，访问 `http://localhost:8089/manage`

### 自动注册

`zhenhuan serve` 启动时自动将后宫 Universe 注册到 `~/.openclaw/uni-registry.json`，无需手动操作。

### 扩展 Dashboard

zhenhuan-uni 启动时自动通过 `DashboardExtension` 接口向核心 Dashboard 注入后宫专属面板（ELO 排行、势力格局、品级等）：

```typescript
import { Hono } from 'hono';
import { startDashboard } from '@agents-uni/core';
import type { DashboardExtension, PanelDefinition } from '@agents-uni/core';

// 创建后宫扩展路由
const extRoutes = new Hono();
extRoutes.get('/leaderboard', (c) => c.json(orchestrator.getLeaderboard()));
extRoutes.get('/factions', (c) => c.json(orchestrator.dynamics.getFactions()));
extRoutes.get('/state', (c) => c.json(orchestrator.getState()));

// 定义首页面板
const panels: PanelDefinition[] = [
  { title: '🏆 ELO 排行榜', renderHtml: () => '<table>...</table>' },
  { title: '⚔️ 势力格局', renderHtml: () => '<div>...</div>' },
  { title: '🏛️ 后宫品级', renderHtml: () => '<div>...</div>' },
];

const extension: DashboardExtension = {
  uniId: 'zhenhuan-palace',
  routes: extRoutes,       // 挂载到 /ext/zhenhuan-palace/
  panels,                  // 显示在首页
};

await startDashboard({ port: 8089, extensions: [extension] });
```

## 架构

```
+-------------------------------------------------------+
|                PalaceOrchestrator                      |
|               （中枢调度）                              |
+-----+-------------+-------------+---------------------+
      |             |             |             |
+-----+------+ +----+------+ +---+--------+ +--+-------------+
| 竞争引擎   | | 后宫领域  | | 演化层     | | OpenClaw 桥接  |
+------------+ +-----------+ +------------+ +----------------+
| EloArena   | | Ranks     | | Performance| | TaskDispatcher |
| HorseRace  | | Resources | | Tracker    | | FileWorkspaceIO|
| Season     | | Dynamics  | | (from core)| | SoulGenerator  |
|            | | Ceremonies| |            | |                |
|            | | ColdPalace| |            | |                |
+------------+ +-----------+ +------------+ +----------------+
                     |                             |
              agents-uni-core                OpenClaw 工作区
       (Universe / Registry / Graph /        (SOUL.md / TASK.md
        StateMachine / EventBus / ...)        / SUBMISSION.md)
```

## 项目结构

```
zhenhuan-uni/
  src/
    competition/     # ELO 竞技场、赛马引擎、赛季系统
    palace/          # 品级、资源、势力博弈、典礼、冷宫
    orchestrator/    # 中枢调度引擎
    server/          # Hono HTTP API 服务器
    cli/             # 命令行工具
    agents/souls/    # 内置 Agent 的 SOUL.md 定义
  universe.yaml      # 完整的后宫组织规范
  DESIGN.md          # 详细设计文档
```

## 开发

```bash
# 安装依赖
npm install

# 类型检查
npx tsc --noEmit

# 运行测试
npm test

# 开发模式（监听重载）
npm run dev

# 构建
npm run build
```

## 相关项目

- [**@agents-uni/core**](https://github.com/agents-uni/core) — 本项目底层的通用 Agent 组织协议层 ([npm](https://www.npmjs.com/package/@agents-uni/core))

## License

MIT
