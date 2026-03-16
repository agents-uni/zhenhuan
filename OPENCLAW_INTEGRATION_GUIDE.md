# OpenClaw 集成指南

> 本文档涵盖以下内容：
> 1. [在已安装的 OpenClaw 上整合 zhenhuan-uni](#part-1-在-openclaw-上整合-zhenhuan-uni)
> 2. [从零创建一个新的 Uni 并整合到 OpenClaw](#part-2-从零创建新-uni-并整合到-openclaw)
> 3. [Dashboard 使用](#part-3-dashboard-使用)
> 4. [多 Uni 共存](#part-4-多-uni-共存)
> 5. [生命周期管理](#part-5-生命周期管理)

---

## Part 1: 在 OpenClaw 上整合 zhenhuan-uni

### 前提条件

- 已安装 OpenClaw 并可正常运行
- Node.js >= 18
- 已克隆 `agents-uni-core` 和 `zhenhuan-uni` 两个项目

### Step 1: 安装依赖

```bash
# 安装 agents-uni-core
cd agents-uni-core
npm install
npm run build

# 安装 zhenhuan-uni
cd ../zhenhuan-uni
npm install
npm run build
```

### Step 2: 生成 SOUL.md 并部署到 OpenClaw

有两种方式将 zhenhuan-uni 的 Agent 部署到 OpenClaw：

#### 方式 A：使用 CLI 一键部署（推荐）

```bash
# 进入 zhenhuan-uni 目录
cd zhenhuan-uni

# 预览将要生成的文件（不实际写入）
npx uni deploy universe.yaml --dry-run

# 部署到默认 OpenClaw 目录（~/.openclaw）
npx uni deploy universe.yaml

# 或指定 OpenClaw 目录
npx uni deploy universe.yaml --dir /path/to/your/openclaw

# 指定 SOUL.md 语言（默认中文）
npx uni deploy universe.yaml --lang en
```

`uni deploy` 会自动完成三件事：
1. **生成 SOUL.md** — 为每个 Agent 创建人格文件到工作区目录
2. **创建 Agent 运行时目录** — 创建 `agents/{id}/agent/` 和 `agents/{id}/sessions/` 目录
3. **注册到 openclaw.json** — 自动将 Agent 写入 OpenClaw 配置（含 `workspace` 和 `agentDir` 字段），无需手动编辑

执行后，OpenClaw 目录下会生成以下结构：

```
~/.openclaw/
├── openclaw.json                  # Agent 注册信息（含 workspace + agentDir）
├── agents/
│   ├── empress/
│   │   ├── agent/                 # 运行时配置（auth-profiles.json 等）
│   │   └── sessions/              # 会话历史
│   ├── zhenhuan/
│   │   ├── agent/
│   │   └── sessions/
│   ├── huafei/
│   │   ├── agent/
│   │   └── sessions/
│   └── ...                        # 其他 Agent 同理
├── workspace-empress/
│   └── SOUL.md                    # 皇后·宜修
├── workspace-zhenhuan/
│   └── SOUL.md                    # 甄嬛
├── workspace-huafei/
│   └── SOUL.md                    # 华妃·年世兰
├── workspace-anlingrong/
│   └── SOUL.md                    # 安陵容
├── workspace-shenmeizhuang/
│   └── SOUL.md                    # 沈眉庄
├── workspace-qiguifei/
│   └── SOUL.md                    # 齐妃·李氏
├── workspace-duanjunwang/
│   └── SOUL.md                    # 端妃
└── zhenhuan-palace-permissions.md  # 权限矩阵参考
```

openclaw.json 中每个 Agent 的注册条目格式：

```json
{
  "id": "zhenhuan",
  "name": "甄嬛",
  "workspace": "/Users/xxx/.openclaw/workspace-zhenhuan",
  "agentDir": "/Users/xxx/.openclaw/agents/zhenhuan/agent"
}
```

#### 方式 B：直接复制预置 SOUL.md

zhenhuan-uni 在 `src/agents/souls/` 下附带了手工调优的 SOUL.md 文件，相比自动生成的版本包含更丰富的性格描写和竞争策略：

```bash
# 确认你的 OpenClaw 工作区目录
OPENCLAW_DIR=~/.openclaw

# 为每个 Agent 创建工作区并复制 SOUL.md
mkdir -p $OPENCLAW_DIR/workspace-zhenhuan
cp src/agents/souls/zhenhuan.md $OPENCLAW_DIR/workspace-zhenhuan/SOUL.md

mkdir -p $OPENCLAW_DIR/workspace-huafei
cp src/agents/souls/huafei.md $OPENCLAW_DIR/workspace-huafei/SOUL.md

mkdir -p $OPENCLAW_DIR/workspace-anlingrong
cp src/agents/souls/anlingrong.md $OPENCLAW_DIR/workspace-anlingrong/SOUL.md

mkdir -p $OPENCLAW_DIR/workspace-shenmeizhuang
cp src/agents/souls/shenmeizhuang.md $OPENCLAW_DIR/workspace-shenmeizhuang/SOUL.md
```

### Step 3: 在 OpenClaw 中验证 Agent

部署完成后，在 OpenClaw 中验证各 Agent 已正确加载：

```bash
# 使用 OpenClaw CLI 列出所有已注册的 Agent
openclaw agents list
# 应显示：empress, zhenhuan, huafei, anlingrong, shenmeizhuang, qiguifei, duanjunwang

# 查看某个 Agent 的 SOUL.md
cat ~/.openclaw/workspace-zhenhuan/SOUL.md

# 验证 Agent 目录结构
ls ~/.openclaw/agents/zhenhuan/
# 应有 agent/ 和 sessions/ 两个子目录

# 测试直接与 Agent 对话（需要先启动 Gateway）
openclaw gateway run &      # 后台启动 Gateway
openclaw agent --agent zhenhuan --message "你好，请介绍一下自己"
```

确保每个 SOUL.md 包含以下关键部分：
- **身份**：Agent 名称、品级、所属组织
- **核心职责**：Agent 应该做什么
- **权限**：Agent 被授权的操作
- **性格特征**：影响 Agent 行为风格的特质
- **关系网络**：与其他 Agent 的关系

### Step 3.5: 动态添加新 Agent（一键注册）

除了初始部署时批量注册，zhenhuan-uni 还支持在运行时动态添加新 Agent：

#### 方式 A：CLI 选秀

```bash
# 一键注册新 Agent 到后宫 + ELO 系统
npm run zhenhuan select --id xinyuan --name "新嫔·馨苑" --role 答应

# 同时注册到 openclaw.json（Agent 立即可用）
npm run zhenhuan select --id xinyuan --name "新嫔·馨苑" --register

# 指定初始品级
npm run zhenhuan select --id xinyuan --name "新嫔·馨苑" --role 贵人 --rank 30
```

#### 方式 B：HTTP API

```bash
# 选秀 — 注册到后宫 + ELO 系统
curl -X POST http://localhost:8089/api/ceremony/selection \
  -H 'Content-Type: application/json' \
  -d '{
    "agents": [
      { "id": "xinyuan", "name": "新嫔·馨苑", "role": "答应" },
      { "id": "ruoxi", "name": "若曦", "role": "常在", "rank": 20 }
    ]
  }'

# 仅注册到 openclaw.json（不参与后宫系统）
curl -X POST http://localhost:8089/api/agents/register \
  -H 'Content-Type: application/json' \
  -d '{
    "agents": [
      { "id": "xinyuan", "name": "新嫔·馨苑" }
    ]
  }'
```

#### 方式 C：编程式调用

```typescript
import { registerAgentsInOpenClaw } from '@agents-uni/core';

// 独立注册到 openclaw.json（写入 workspace + agentDir）
registerAgentsInOpenClaw(universeConfig, '~/.openclaw');

// 或者通过编排器进行选秀
const result = await orchestrator.ceremonies.conductSelection([{
  id: 'xinyuan',
  name: '新嫔·馨苑',
  role: { title: '答应', duties: [], permissions: [] },
  rank: 10,
}]);
// 注册后还需加入 ELO 系统
orchestrator.arena.register('xinyuan', 1000);
```

> **一键注册的底层流程**：
> 1. `conductSelection()` → 注册到 AgentRegistry + 触发 `agent.joined` 事件
> 2. `arena.register()` → 注册到 ELO 竞技系统，初始分 1000
> 3. `registerAgentsInOpenClaw()` → 写入 `workspace` 和 `agentDir` 到 `openclaw.json`，Agent 立即对 OpenClaw 可见

### Step 4: 运行赛马竞技（自动调度）

Agent 部署到 OpenClaw 后，使用 `dispatchAndRace()` 一键完成整个赛马流程：

```typescript
import { PalaceOrchestrator } from 'zhenhuan-uni';

// 从 universe.yaml 初始化（自动连接 OpenClaw 工作区）
const orchestrator = await PalaceOrchestrator.fromSpec('universe.yaml');

// 一键完成：写 TASK.md → 等待 SUBMISSION.md → 评审 → ELO 更新
const { dispatch, race } = await orchestrator.dispatchAndRace(
  {
    id: 'task-001',
    title: '撰写一篇策论',
    description: '就"如何提升团队协作效率"撰写一篇500字的策论',
    criteria: [
      { name: '质量', weight: 0.4, description: '论述深度和逻辑性' },
      { name: '创意', weight: 0.3, description: '视角的独特性' },
      { name: '速度', weight: 0.3, description: '完成用时' },
    ],
    timeoutMs: 120000, // 2 分钟超时
    participants: ['zhenhuan', 'huafei', 'anlingrong', 'shenmeizhuang'],
  },
  myJudgeFunction // 评审函数（可以用 LLM、规则引擎，或用户手动评审）
);

console.log('提交:', dispatch.submissions.length);  // 收到几份提交
console.log('超时:', dispatch.timedOut);              // 哪些 Agent 超时未提交
console.log('排名:', race?.rankings);                 // ['zhenhuan', 'anlingrong', ...]
console.log('ELO 变化:', race?.eloChanges);           // Map { 'zhenhuan' => +24, ... }
console.log('ELO 排行榜:', orchestrator.getLeaderboard());
```

**底层发生了什么？**

1. `TaskDispatcher` 向每个参赛者的 `~/.openclaw/workspace-{id}/` 写入 `TASK.md`
2. 各 Agent（在 OpenClaw 中运行）读取 `TASK.md`，执行任务，写入 `SUBMISSION.md`
3. `TaskDispatcher` 轮询 `SUBMISSION.md`（默认每 2 秒），直到全部收集或超时
4. 收集到的提交交给 `HorseRaceEngine` 评审 → ELO 更新 → 圣宠奖励

### Step 5: 运行朝会（月度评审）

```typescript
// 触发朝会 - 评审所有 Agent 的月度表现，执行晋升/降级
await orchestrator.runCourtAssembly();

// 查看各 Agent 的详细状态
const state = orchestrator.getState();
console.log('后宫状态:', JSON.stringify(state, null, 2));
```

### Step 6：使用 HTTP API（可选）

zhenhuan-uni 提供了 HTTP API 服务，支持通过 HTTP 调用完整的调度赛马流程：

```bash
# 启动 HTTP 服务（默认端口 8089）
npx zhenhuan serve --spec universe.yaml
# 启动后会打印：
#   首页:      http://localhost:8089
#   API:       http://localhost:8089/api
#   管理:      http://localhost:8089/manage
#   用户手册:  http://localhost:8089/guide
```

```bash
# 一键调度赛马（自动写 TASK.md → 收集 SUBMISSION.md → 评审）
curl -X POST http://localhost:8089/api/race/dispatch \
  -H 'Content-Type: application/json' \
  -d '{
    "task": {
      "id": "race-001",
      "title": "撰写策论",
      "description": "就提升团队效率撰写500字策论",
      "criteria": [{"name": "质量", "weight": 0.6, "description": "深度"}],
      "timeoutMs": 120000,
      "participants": ["zhenhuan", "huafei", "anlingrong"]
    }
  }'
```

**完整 API 端点：**

```
GET  /api/state               # 后宫完整状态
GET  /api/leaderboard         # ELO 排行榜
GET  /api/agents/:id          # Agent 详情
POST /api/race/dispatch       # 🆕 自动调度赛马（TASK.md → SUBMISSION.md → 评审）
POST /api/race/evaluate       # 手动提交结果评审
GET  /api/race/history        # 赛马历史
POST /api/ceremony/court-assembly  # 召开朝会
POST /api/ceremony/selection       # 🆕 选秀（一键注册新 Agent）
POST /api/agents/register          # 🆕 注册 Agent 到 openclaw.json
POST /api/alliance            # 结盟
POST /api/cold-palace/banish  # 打入冷宫
POST /api/season/start        # 开启新赛季
```

### 完整联动流程图

```
┌─────────────────────────────────────────────────────┐
│                    zhenhuan-uni                       │
│                                                       │
│  universe.yaml → PalaceOrchestrator                   │
│       │               │                               │
│       │         dispatchAndRace()                      │
│       │               │                               │
│       │    ┌──────────┼──────────┐                    │
│       │    │          │          │                    │
│       │    ▼          ▼          ▼                    │
│       │  TaskDispatcher → HorseRace → SeasonEngine   │
│       │  (TASK.md →     (评审+ELO)   (赛季晋升)      │
│       │   SUBMISSION.md)                              │
│       ▼                                              │
│  uni deploy → SOUL.md × N                            │
└───────┬────────────────┬─────────────────────────────┘
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   OpenClaw    │  │   OpenClaw    │  │   OpenClaw    │
│  workspace    │  │  workspace    │  │  workspace    │
│   甄嬛        │  │   华妃        │  │   沈眉庄      │
│  SOUL.md     │  │  SOUL.md     │  │  SOUL.md     │
│  TASK.md  ←──┤  │  TASK.md  ←──┤  │  TASK.md  ←──┤ ← TaskDispatcher 写入
│    ↓          │  │    ↓          │  │    ↓          │
│  Agent 执行   │  │  Agent 执行   │  │  Agent 执行   │
│    ↓          │  │    ↓          │  │    ↓          │
│  SUBMISSION   │  │  SUBMISSION   │  │  SUBMISSION   │
│  .md ────────►│  │  .md ────────►│  │  .md ────────►│ → TaskDispatcher 收集
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Part 2: 从零创建新 Uni 并整合到 OpenClaw

下面以创建一个「三国争霸」主题的 Agent 竞争体系为例，完整演示从 0 到 1 的流程。

### Step 1: 初始化项目

```bash
# 使用 agents-uni-core 的 CLI 初始化
npx uni init sanguo-uni

# 进入项目目录
cd sanguo-uni

# 安装依赖
npm install
```

生成的目录结构：

```
sanguo-uni/
├── universe.yaml   # 组织规范（模板生成，需自定义）
├── package.json
└── README.md
```

### Step 2: 编写 universe.yaml

这是整个系统的核心——用 YAML 声明式地定义你的 Agent 组织。打开 `universe.yaml`，替换为你的自定义规范：

```yaml
# 三国争霸 Agent 竞争体系
name: sanguo-arena
type: competitive
description: >
  以三国为背景的 Agent 竞争体系。
  群雄逐鹿，能者胜出。
version: "0.1.0"

# ─── 1. 定义 Agent ───────────────────────────
agents:
  - id: judge
    name: 天子
    role:
      title: 仲裁者
      duties:
        - 评判竞赛结果
        - 决定排名变动
      permissions: [approve, reject, promote, demote]
    rank: 100
    traits:
      fairness: 0.9

  - id: caocao
    name: 曹操
    role:
      title: 魏王
      duties:
        - 完成竞赛任务
        - 制定策略
      permissions: [call, assign]
    rank: 60
    traits:
      cunning: 0.9
      execution: 0.85
      ambition: 0.95
    # 可选：约束和能力
    constraints:
      - 不得虚报战果
    capabilities:
      - 军事策略分析
      - 人才招募

  - id: liubei
    name: 刘备
    role:
      title: 蜀主
      duties:
        - 完成竞赛任务
        - 以仁义服人
      permissions: [call]
    rank: 50
    traits:
      benevolence: 0.9
      leadership: 0.85
      resilience: 0.8

  - id: sunquan
    name: 孙权
    role:
      title: 吴侯
      duties:
        - 完成竞赛任务
        - 善用人才
      permissions: [call]
    rank: 50
    traits:
      diplomacy: 0.85
      patience: 0.9
      judgment: 0.8

# ─── 2. 定义关系 ───────────────────────────────
relationships:
  - { from: caocao, to: liubei, type: rival, weight: 0.9 }
  - { from: caocao, to: sunquan, type: rival, weight: 0.7 }
  - { from: liubei, to: sunquan, type: ally, weight: 0.6 }

# ─── 3. 治理规则 ───────────────────────────────
governance:
  decisionModel: autocratic
  permissionMatrix:
    - { actor: judge, target: caocao, actions: [approve, reject, promote, demote] }
    - { actor: judge, target: liubei, actions: [approve, reject, promote, demote] }
    - { actor: judge, target: sunquan, actions: [approve, reject, promote, demote] }
  reviewPolicy:
    mandatory: true
    reviewers: [judge]
    maxRounds: 3
  escalationRules:
    - trigger: "争议涉及多方"
      escalateTo: judge
      action: reassign

# ─── 4. 竞争协议 ───────────────────────────────
protocols:
  - name: battle
    description: 战役 - 多个 Agent 同时完成任务
    states:
      - { name: declared, label: 宣战 }
      - { name: fighting, label: 交战中 }
      - { name: judging, label: 评判 }
      - { name: settled, label: 尘埃落定, terminal: true }
    transitions:
      - { from: declared, to: fighting, label: battle_start }
      - { from: fighting, to: judging, label: all_submitted }
      - { from: judging, to: settled, requiredRole: 仲裁者 }

# ─── 5. 资源定义 ───────────────────────────────
resources:
  - name: 军功
    type: finite
    total: 10000
    distribution: competitive
    decayRate: 0.03
    description: 通过竞赛获得的功勋

  - name: 粮草
    type: renewable
    total: 50000
    distribution: hierarchy
    refreshInterval: 2592000000
    description: 月度资源，按排名分配

# ─── 6. 演化配置 ───────────────────────────────
evolution:
  performanceWindow: 50
  promotionThreshold: 75
  demotionThreshold: 30
  memoryRetention: 1000
  evolutionInterval: 604800000

metadata:
  theme: 三国
  mission: "逐鹿中原，能者为王"
```

### Step 3: 验证规范

```bash
# 验证 universe.yaml 格式和内容
npx uni validate universe.yaml

# 可视化 Agent 关系图
npx uni visualize universe.yaml

# 预览 Agent 详情
npx uni inspect universe.yaml
npx uni inspect universe.yaml --agent caocao
```

输出示例：

```
✓ Universe "sanguo-arena" is valid

  Agents:  4 (1 judge, 3 competitors)
  Relationships: 3
  Protocols: 1
  Resources: 2
```

### Step 4: 编写自定义 SOUL.md（可选但推荐）

自动生成的 SOUL.md 已包含基本信息，但手工调优可以让 Agent 表现更有特色。在项目下创建 `souls/` 目录：

```bash
mkdir -p souls
```

创建 `souls/caocao.md`：

```markdown
# 曹操 - 魏王

## 身份
你是曹操，乱世之奸雄，治世之能臣。你通过卓越的执行力和战略眼光在竞争中胜出。

## 核心特质
- **雄才大略**: 善于制定全局战略，找到最高效的解决方案
- **唯才是举**: 重视能力而非出身，善于发现问题的本质
- **果断决策**: 在信息不完整时也能快速做出判断
- **诗以言志**: 在需要创意表达的任务中有独特视角

## 竞争策略
- 追求效率和结果导向，快速交付高质量输出
- 善于分析对手弱点，针对性制定策略
- 必要时敢于冒险，追求高风险高回报

## 关系网络
- **对手**: 刘备（理念之争）、孙权（利益之争）

## 当前目标
通过竞赛积累 ELO 分数，争取排名第一。
```

为其他 Agent 创建类似的 SOUL.md 文件。

### Step 5: 部署到 OpenClaw

```bash
# 方式 A：从 universe.yaml 自动生成并部署
npx uni deploy universe.yaml

# 指定 OpenClaw 目录
npx uni deploy universe.yaml --dir ~/.openclaw

# 先预览不实际写入
npx uni deploy universe.yaml --dry-run
```

```bash
# 方式 B：使用手工编写的 SOUL.md
OPENCLAW_DIR=~/.openclaw

mkdir -p $OPENCLAW_DIR/workspace-caocao
cp souls/caocao.md $OPENCLAW_DIR/workspace-caocao/SOUL.md

mkdir -p $OPENCLAW_DIR/workspace-liubei
cp souls/liubei.md $OPENCLAW_DIR/workspace-liubei/SOUL.md

mkdir -p $OPENCLAW_DIR/workspace-sunquan
cp souls/sunquan.md $OPENCLAW_DIR/workspace-sunquan/SOUL.md
```

> **注意**：`uni deploy` 会自动将 Agent 注册到 `openclaw.json`（含 `workspace` 和 `agentDir` 字段），并创建 `agents/{id}/agent/` + `agents/{id}/sessions/` 目录。如需单独注册（例如方式 B 手动部署时），可以调用：
>
> ```typescript
> import { registerAgentsInOpenClaw } from '@agents-uni/core';
> registerAgentsInOpenClaw(universeConfig, '~/.openclaw');
> // 写入 workspace 和 agentDir 到 openclaw.json
> ```

### Step 6: 编写竞争逻辑

创建 `src/index.ts` 作为竞赛运行入口。使用 `TaskDispatcher` 自动完成任务下发和提交收集：

```typescript
import {
  parseSpecFile,
  compileUniverse,
  TaskDispatcher,
  FileWorkspaceIO,
  PerformanceTracker,
  deployToOpenClaw,
} from '@agents-uni/core';

// 1. 加载 universe
const config = parseSpecFile('universe.yaml');
const universe = await compileUniverse(config, { autoInit: true });

// 2. 初始化调度器和演化追踪
const dispatcher = new TaskDispatcher(
  new FileWorkspaceIO({ openclawDir: '~/.openclaw' }),
  { eventBus: universe.events }
);
const tracker = new PerformanceTracker(config.evolution);

// 3. 下发任务并收集提交（全自动）
const dispatchResult = await dispatcher.run({
  id: 'battle-001',
  title: '攻城策略',
  description: '制定一个攻克敌方城池的完整策略方案',
  criteria: [
    { name: '战略性', weight: 0.5, description: '策略的可行性和深度' },
    { name: '创新性', weight: 0.3, description: '方案的独创性' },
    { name: '表达力', weight: 0.2, description: '论述的清晰度' },
  ],
  timeoutMs: 120000, // 2 分钟
  participants: ['caocao', 'liubei', 'sunquan'],
});

console.log('收到提交:', dispatchResult.submissions.length);
console.log('超时未提交:', dispatchResult.timedOut);

// 4. 评审（可以用 LLM、规则、或自定义函数）
for (const sub of dispatchResult.submissions) {
  const score = await evaluateWithLLM(sub.output, '攻城策略');
  tracker.record(sub.agentId, 'battle-001', score, {
    quality: score * 0.8,
    speed: score * 0.6,
    creativity: score * 0.9,
  });
}

// 5. 查看排行
const leaderboard = tracker.getLeaderboard();
console.log('排行榜:', leaderboard);

// 6. 根据表现晋升/降级
for (const entry of leaderboard) {
  if (tracker.getAverageScore(entry.agentId) >= config.evolution.promotionThreshold) {
    await universe.events.emitSimple('agent.promoted', [entry.agentId], '表现优异，晋升');
  }
}
```

### Step 7: 联动闭环 — 更新 SOUL.md

竞赛结束后，根据排名变化重新生成 SOUL.md 并更新 OpenClaw：

```typescript
// 晋升/降级后，重新生成 SOUL.md 并部署
const updatedConfig = parseSpecFile('universe.yaml');

deployToOpenClaw(updatedConfig, {
  openclawDir: '~/.openclaw',
  soulOptions: { language: 'zh', includeRelationships: true },
});

// 此时 OpenClaw 中各 Agent 的 SOUL.md 已更新
// Agent 在下次收到 TASK.md 时会加载新的身份信息
```

### Step 8: 赛季循环

建立持续运营的竞赛节奏：

```
赛季开始（第1天）
    ↓
每周赛马（竞赛任务 × N）
    ↓ TaskDispatcher 写 TASK.md → Agent 执行 → 写 SUBMISSION.md
    ↓ TaskDispatcher 收集 → 评审 → ELO 更新
    ↓
月度朝会（第30天）
    ↓ 评审月度表现
    ↓ 晋升 Top 20% / 降级 Bottom 15%
    ↓ deployToOpenClaw() → 更新 SOUL.md（含新品级）
    ↓
赛季结束 → 下一赛季
```

---

## Part 3: Dashboard 使用

agents-uni-core 内置了 Web Dashboard，用于浏览和管理所有已部署的 Universe。

**zhenhuan-uni 已集成 Dashboard**，启动 `zhenhuan serve` 后直接访问首页即可，无需单独启动 Dashboard。

如需独立使用 Dashboard（不启动具体 uni 的服务），也可以：

```bash
# 默认端口 8089
uni dashboard

# 指定端口
uni dashboard --port 9090
```

### 页面说明

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 项目介绍 + 所有已注册 Universe 概览 + 架构图 + 快速上手 |
| 用户手册 | `/guide` | 完整使用指南：概念、工作流、CLI 参考、文件协议、多 Uni 管理 |
| Uni 详情 | `/uni/:id` | 单个 Universe 的 Agent 列表、关系图谱、资源状态 |
| Agent 详情 | `/uni/:id/agent/:agentId` | Agent 的品级、ELO、会话历史、SOUL.md 内容 |
| 管理 | `/manage` | 批量 reset / cleanup / update 操作面板 |

### Dashboard API

Dashboard 同时提供 JSON API，可用于自动化脚本或外部工具集成：

```
GET  /api/unis                         # 列出所有已注册的 Universe
GET  /api/unis/:id                     # 获取单个 Universe 详情
GET  /api/unis/:id/agents/:agentId     # 获取 Agent 详情
GET  /api/unis/:id/relationships       # 获取关系图谱
POST /api/unis/:id/reset               # 重置 Universe 运行时数据
POST /api/unis/:id/cleanup             # 清理 Universe 及所有文件
GET  /api/health                       # 健康检查
```

### 扩展机制

特定 Uni 可以通过 `DashboardExtension` 接口向 Dashboard 注入自定义路由和面板。例如 zhenhuan-uni 启动时会自动注册扩展面板（ELO 排行榜、派系图等）。

---

## Part 4: 多 Uni 共存

当多个 Universe 部署在同一台机器上时，通过 `uni-registry.json` 实现命名空间隔离和统一管理。

### 注册中心

注册信息存储在 `~/.openclaw/uni-registry.json`，每个 Universe 在部署时自动注册。

```
~/.openclaw/
├── openclaw.json          ← Agent 配置（所有 Uni 共享）
├── uni-registry.json      ← 🆕 多 Uni 注册中心
├── agents/
│   ├── zhenhuan/          ← zhenhuan-uni 的 Agent
│   ├── caocao/            ← sanguo-uni 的 Agent
│   └── ...
├── workspace-zhenhuan/    ← zhenhuan-uni 工作区
├── workspace-caocao/      ← sanguo-uni 工作区
└── ...
```

### 自动注册

- `uni deploy universe.yaml`（传入 `specPath`）时自动注册
- `zhenhuan serve` 启动时自动注册
- 也可以编程式调用 `registerUni()`

### 隔离机制

每个 Universe 有独立的：
- 工作区目录（`workspace-{agentId}/`）
- Agent 运行时目录（`agents/{agentId}/`）
- 注册中心条目（`uni-registry.json` 中的独立记录）

所有 Agent 共享同一个 `openclaw.json`，通过 `agentId` 前缀或 Uni 归属关系区分。

### 在 Dashboard 中浏览多个 Uni

启动 Dashboard 后，首页会列出所有已注册的 Universe，点击可进入各自的详情页：

```bash
uni dashboard
# 访问 http://localhost:8089
# 首页展示：zhenhuan-uni、sanguo-uni、my-team-uni ...
```

---

## Part 5: 生命周期管理

### 完整生命周期

```
创建 → 部署 → 运行 → 重置 → 更新 → 清理
```

| 阶段 | 操作 | 命令 / API |
|------|------|-----------|
| 创建 | 编写 universe.yaml | `uni init` |
| 部署 | 生成 SOUL.md + 注册 Agent + 注册到 uni-registry | `uni deploy` |
| 运行 | 下发任务、收集提交、评审 | `dispatchAndRace()` / HTTP API |
| 重置 | 清除 sessions、TASK.md、SUBMISSION.md，保留 SOUL.md | `uni reset <id>` |
| 更新 | 重新部署 SOUL.md，处理新增/移除的 Agent | `updateUni()` |
| 清理 | 删除所有文件 + 从 openclaw.json 移除 + 从注册中心移除 | `uni cleanup <id>` |

### 重置（Reset）

重置会清除运行时数据，但保留 Agent 的配置和人格定义：

```bash
uni reset zhenhuan-palace
```

清除内容：
- `agents/{id}/sessions/` 中的会话历史
- 各工作区中的 `TASK.md` 和 `SUBMISSION.md`

保留内容：
- `SOUL.md`（Agent 人格定义）
- `agents/{id}/agent/` 中的运行时配置
- `openclaw.json` 中的注册信息
- `uni-registry.json` 中的注册信息

### 更新（Update）

当 universe.yaml 发生变化（新增/移除 Agent、修改角色等）时，使用 `updateUni()` 同步：

```typescript
import { updateUni } from '@agents-uni/core';

await updateUni('zhenhuan-palace', {
  specPath: './universe.yaml',
  openclawDir: '~/.openclaw',
});
// 重新部署 SOUL.md
// 为新增的 Agent 创建工作区和运行时目录
// 为移除的 Agent 清理相关文件
```

### 清理（Cleanup）

彻底删除一个 Universe 及其所有关联文件：

```bash
uni cleanup zhenhuan-palace
```

执行内容：
- 删除所有 `workspace-{agentId}/` 目录
- 删除所有 `agents/{agentId}/` 目录
- 从 `openclaw.json` 中移除 Agent 条目
- 从 `uni-registry.json` 中移除 Universe 条目

### 更新后的完整流程图

```
┌─────────────────────────────────────────────────────────┐
│                    zhenhuan-uni                           │
│                                                           │
│  universe.yaml → PalaceOrchestrator                       │
│       │               │                                   │
│       │         dispatchAndRace()                          │
│       │               │                                   │
│       │    ┌──────────┼──────────┐                        │
│       │    │          │          │                        │
│       │    ▼          ▼          ▼                        │
│       │  TaskDispatcher → HorseRace → SeasonEngine       │
│       │  (TASK.md →     (评审+ELO)   (赛季晋升)          │
│       │   SUBMISSION.md)                                  │
│       ▼                                                  │
│  uni deploy → SOUL.md × N                                │
│       │                                                  │
│       ▼                                                  │
│  uni-registry.json ← 🆕 自动注册                         │
└───────┬────────────────┬─────────────────────────────────┘
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   OpenClaw    │  │   OpenClaw    │  │   Dashboard   │
│  workspace    │  │  workspace    │  │  (port 8089)  │
│   甄嬛        │  │   华妃        │  │               │
│  SOUL.md     │  │  SOUL.md     │  │  浏览所有 Uni  │
│  TASK.md     │  │  TASK.md     │  │  管理生命周期   │
│  SUBMISSION  │  │  SUBMISSION  │  │  查看 Agent    │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        ▼                ▼                ▼
   ~/.openclaw/uni-registry.json ← 统一注册中心
```

---

## 附录 A：universe.yaml 完整字段参考

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 组织名称 |
| `type` | string | 是 | 组织类型：`hierarchical`/`flat`/`competitive`/`hybrid` |
| `description` | string | 是 | 组织描述 |
| `version` | string | 是 | 规范版本 |
| `agents` | Agent[] | 是 | Agent 定义列表 |
| `agents[].id` | string | 是 | Agent 唯一标识 |
| `agents[].name` | string | 是 | Agent 显示名称 |
| `agents[].role.title` | string | 是 | 角色头衔 |
| `agents[].role.duties` | string[] | 是 | 职责列表 |
| `agents[].role.permissions` | string[] | 是 | 权限列表 |
| `agents[].rank` | number | 否 | 品级（0-100） |
| `agents[].traits` | Record | 否 | 性格特质（0.0-1.0） |
| `agents[].constraints` | string[] | 否 | 行为约束 |
| `agents[].capabilities` | string[] | 否 | 可用技能 |
| `relationships` | Relationship[] | 是 | 关系定义 |
| `relationships[].type` | string | 是 | `superior`/`subordinate`/`peer`/`ally`/`rival` |
| `governance` | Governance | 是 | 治理规则 |
| `protocols` | Protocol[] | 是 | 流程协议（状态机） |
| `resources` | Resource[] | 否 | 资源定义 |
| `evolution` | Evolution | 否 | 演化配置 |
| `metadata` | Record | 否 | 自定义元数据 |

## 附录 B：CLI 命令速查

```bash
# 初始化新项目
uni init <project-name>

# 验证规范
uni validate <universe.yaml>

# 可视化关系图
uni visualize <universe.yaml>

# 查看详情
uni inspect <universe.yaml>
uni inspect <universe.yaml> --agent <agent-id>

# 部署到 OpenClaw（创建工作区 + Agent 运行时目录 + 自动注册到 openclaw.json + uni-registry.json）
uni deploy <universe.yaml>
uni deploy <universe.yaml> --dry-run
uni deploy <universe.yaml> --dir /path/to/openclaw
uni deploy <universe.yaml> --lang en

# 🆕 启动 Dashboard 仪表盘
uni dashboard [--port 8089]

# 🆕 列出所有已注册的 Universe
uni list

# 🆕 查看已部署的 Uni / Agent 概览
uni status

# 🆕 清理一个 Universe（删除所有文件 + 注册信息）
uni cleanup <id>

# 🆕 重置一个 Universe（清除运行时数据，保留 SOUL.md）
uni reset <id>

# 选秀 — 一键注册新 Agent（zhenhuan-uni CLI）
zhenhuan select --id <agent-id> --name <name>
zhenhuan select --id <agent-id> --name <name> --role <role> --register
```

## 附录 C：可用模板

使用 `uni init` 时可选的模板：

| 模板 | 说明 | 适合场景 |
|------|------|---------|
| `competitive` | 竞技场（默认） | 赛马竞争、Agent 对比评测 |
| `corporation` | 现代企业 | 层级化团队协作 |
| `government` | 三省六部 | 审批流程、多级治理 |
| `flat` | 扁平团队 | 对等协作、无明确层级 |
| `military` | 军事指挥 | 严格的指挥链、快速执行 |

## 附录 D：文件协议（TASK.md / SUBMISSION.md）

### TASK.md 格式

`TaskDispatcher` 自动生成的 `TASK.md` 格式如下：

```markdown
# 📋 Task: 撰写策论

> **Task ID**: `task-001`
> **Participant**: `zhenhuan`
> **Time Limit**: 120s

---

## Description

就"如何提升团队协作效率"撰写一篇500字的策论...

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| 质量 | 0.6 | 内容深度 |
| 创意 | 0.4 | 创新性 |

## How to Submit

Write your response to a file named `SUBMISSION.md` in this workspace directory.
The dispatcher will automatically collect your submission.
```

### SUBMISSION.md 格式

Agent 只需将输出写入 `SUBMISSION.md`，内容即为提交。无需特殊格式：

```markdown
# 关于提升团队协作效率的策论

（Agent 的实际输出内容）
```

### 自定义 WorkspaceIO

如果不使用文件系统（例如远程 Agent），可以实现 `WorkspaceIO` 接口：

```typescript
import type { WorkspaceIO } from '@agents-uni/core';

class RemoteWorkspaceIO implements WorkspaceIO {
  async writeTask(agentId: string, content: string) { /* HTTP POST */ }
  async readSubmission(agentId: string) { /* HTTP GET, return null if not ready */ }
  async clearTask(agentId: string) { /* cleanup */ }
  async clearSubmission(agentId: string) { /* cleanup */ }
  async hasSubmission(agentId: string) { /* quick check */ }
}

const dispatcher = new TaskDispatcher(new RemoteWorkspaceIO());
```

测试时可以用内存实现：

```typescript
import { MemoryWorkspaceIO, TaskDispatcher } from '@agents-uni/core';

const io = new MemoryWorkspaceIO();
const dispatcher = new TaskDispatcher(io, { pollIntervalMs: 100 });

// 模拟 Agent 提交
setTimeout(() => io.simulateSubmission('agent-a', '我的答案...'), 500);

const result = await dispatcher.run(task);
```

## 附录 E：SOUL.md 自动生成内容

从 universe.yaml 自动生成的 SOUL.md 包含以下章节：

1. **身份** — Agent 名称、头衔、品级、所属组织
2. **核心职责** — 来自 `role.duties`
3. **权限** — 来自 `role.permissions`
4. **性格特征** — 来自 `traits`，以可视化进度条展示
5. **关系网络** — 来自 `relationships`，标注关系方向和类型
6. **行为约束** — 来自 `constraints`
7. **可用技能** — 来自 `capabilities`
8. **组织背景** — 组织名称、类型、描述、治理模式
