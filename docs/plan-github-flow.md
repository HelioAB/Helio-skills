# GitHub Flow 迁移：说明与执行计划

- **状态**：待外部审阅；审阅通过前不执行。
- **日期**：2026-10-21
- **分支**：`repo/github-flow`
- **基线**：`main @ df40683`（已删除 grill-x docs-mode 产物）
- **执行方式**：审阅通过后，在一个新 session 中按本文件执行。
- **范围**：只改流程与工具；不改任何 skill 的行为。

## 0. 背景与决策

### 0.1 为什么要改

当前 `AGENTS.md` 用“轮”作为迭代单位，但“一轮”可以跨多条分支。这个模型：

- 与“一个工作项 = 一条分支 = 一个 PR”的常见认知相悖；
- 与 GitHub Flow 的默认模型相悖；
- 需要读者先理解一个本仓库自造的概念，增加人和 LLM 的误读概率。

### 0.2 目标模型

采用**方案 B：GitHub Flow + staging/UAT**。

- 一个工作项 = 一条分支 = 一个 PR = 一次行为变更。
- **门槛 1（CI）** 在合入前跑确定性检查。
- **门槛 2（UAT）** 在合入前、于分支的 worktree 上真实使用；本地 junction 临时指向该 worktree。
- 两道门都通过后才 merge 到 `main`。
- 合入后删除分支，junction 指回 `skills/`。

```text
main    ──●──────────────────────────────────────────●────────▶
           \                                        /
            ●──●──●── CI ✅ ── 真实使用 ✅ ── 用户认可 ── merge
            branch X/topic（draft PR）
            │        │              │
            │        │              └ 验收通过后才合入 main
            │        └ junction 指向该分支的 worktree
            └ 提交；缺陷继续在本分支修
```

### 0.3 已完成的决策

- 方案 B 已获用户同意。
- junction 切换工具已获用户同意。
- 删除 `CONTEXT.md` 与 `docs/adr/` 已获用户同意并完成（`df40683`）。它们由 grill-x 的 docs 模式在开发 `session-log` 时产出，不是仓库约定；该行为记为 grill-x 的缺陷，本文不再处理。
- 本文件只做计划与备份；不执行。

## 1. 目标流程

### 1.1 定义

| 单位 | 定义 |
|---|---|
| **工作项** | 一个变更意图 + 验收标准；对应 `_dev/plan.md` 一份、`_dev/test-log.md` 一节 |
| **分支** | 工作项的实现；从最新 `main` 创建，命名 `<skill>/<topic>` |
| **PR** | 分支的审阅/合入载体；solo 仓库可 self-review |
| **提交** | 分支上的一个记录点 |
| **门槛 1（CI）** | 合入前的确定性检查：结构/打包、frontmatter、相对链接、脚本语法、夹具回归、仓库不变式；不调用 LLM |
| **门槛 2（UAT）** | 合入前的非确定性验证：在分支 worktree 上真实使用，检查 transcript/输出，结论记入 test-log，并经用户认可 |

`main` 始终可用。一个工作项对应一条分支和一个 PR；不再使用“轮”作为独立概念。

### 1.2 流程

```text
1. 写 plan.md / 开 issue，定义验收标准
2. 从最新 main 开分支 X/topic，开 draft PR
3. 提交 → CI（门槛 1）
4. junction 指向该分支的 worktree
5. 真实项目使用（门槛 2）
   ├─ 发现缺陷 → 同一分支继续提交，回到 3
   └─ 发现新需求 → 不塞进本分支；新工作项
6. 用户认可 → merge 到 main → 删除分支 → junction 指回 skills/
7. test-log 写关闭条目；没有 close 提交
```

### 1.3 缺陷 vs 新需求

- **缺陷**：没有达到 `plan.md` 已声明的意图。同一分支继续提交，重跑门槛 1，重新验收。
- **新需求**：超出 `plan.md` 的意图。关闭当前工作项后，开新工作项/新分支。

### 1.4 串行迭代

同一 skill 同时只开一条分支（WIP limit = 1）；不同 skill 可以并行。

### 1.5 junction 切换

```text
验收期间：.claude/skills/<skill> → <worktree>/skills/<skill>
合入之后：.claude/skills/<skill> → skills/<skill>
```

由 `scripts/link-skill.mjs` 执行，接口见 3.3。

## 2. 当前状态

- 分支 `repo/github-flow` 从 `main @ df40683` 创建；本文件是其第一个提交。
- `skills/grill-x/`：纯文本 skill，无脚本。
- `skills/session-log/`：脚本型 skill，`claude-code.mjs`（873 行）+ `export.mjs`（149 行），七个命令的统一接口。
- 仓库没有 `.github/`、`package.json`、测试夹具；门槛 1 目前只是手工跑脚本并记入 `_dev/test-log.md`。
- Node `v22.18.0` 可用。
- 本地 `.claude/skills/grill-x`、`.claude/skills/session-log` 当前是指向 `skills/<name>` 的 symlink。

## 3. 执行项

### 3.0 分支与本文档（已完成）

- 创建 `repo/github-flow` 分支。
- 提交本文件。

### 3.1 CI 基础设施

**新增 `scripts/check.mjs`**（零依赖，Node ≥ 18）：

- CLI：`node scripts/check.mjs [--skill <name>]`。
- 仓库不变式：
  - `CLAUDE.md` 仍是指向 `AGENTS.md` 的固定指针（与 `.githooks/pre-commit` 同一断言）。
  - `git ls-files` 下没有 `skills/**/_dev/**` 或 `skills/**/_sources/**`。
  - `skills/` 下的目录名是 kebab-case。
- 每个 skill 的结构：
  - `skills/<name>/SKILL.md` 存在。
  - frontmatter 可解析；`name` 与目录名一致；`description` 非空。
  - `SKILL.md` 与 `references/*.md` 中的相对链接都能解析（忽略 `http(s)://`、`mailto:`、纯锚点）。
  - `references/` 下的文件非空。
- 脚本：
  - 对 `skills/` 和 `scripts/` 下所有 `.mjs` 跑 `node --check`。
- 夹具测试：
  - 若存在 `skills/<name>/tests/run.mjs`，执行 `node <tests/run.mjs>`，透传退出码。
- CHANGELOG 软检查（可选，默认只警告）：
  - 在 GitHub Actions 中且有 `GITHUB_BASE_REF` 时，比较 `origin/<base>...HEAD`；若 `skills/` 变更而 `CHANGELOG.md` 未变，打印 warning，不失败。
- 输出：每个检查一行 `PASS`/`FAIL`；最后汇总；有硬失败时退出码 1。
- 不联网、不调用 LLM。

**新增 `.github/workflows/ci.yml`**：

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/check.mjs
```

无 `npm install`，无外部依赖。

### 3.2 `session-log` 测试

**新增 `skills/session-log/tests/`**：

- `fixtures/minimal.jsonl`：合成夹具，不含真实数据。至少包含：
  - 普通 user prompt；
  - assistant 文本；
  - tool_use + tool_result；
  - harness 注入的 meta entry（`Base directory for this skill...`）；
  - command entry（`[cmd]`）；
  - 多个 turn，用于测试 current-invocation 的尾部裁剪。
- `golden/`：七个命令的期望输出；`export` 的五视图也可做 golden。
- `run.mjs`：零依赖测试入口，由根 `check.mjs` 自动发现。

**测试用例**：

1. `summary`、`transcript`、`user`、`tools`、`usage`、`get`、`grep` 对夹具的输出与 golden 一致（或断言关键不变量）。
2. `transcript` 的 `--no-meta`、`--no-cmd`、`--no-tools` 行为符合预期。
3. `--json` 输出是合法 JSON/NDJSON。
4. `--include-current` 的尾部裁剪行为；用临时 `CLAUDE_CONFIG_DIR` + `CLAUDE_CODE_SESSION_ID` 模拟 current locator；若环境依赖过强，先只测显式路径，并在测试注释中说明。
5. `export.mjs` 写出五个文件；重复运行 byte-identical。
6. 非法命令/非法路径返回非零退出码。
7. 同一命令跑两次，输出一致。

**注意**：golden 由当前实现生成后必须人工检查；如果发现现有实现有 bug，先报告，不夹带修复，也不把 bug 固化成 golden。

### 3.3 junction 切换工具

**新增 `scripts/link-skill.mjs`**（零依赖，Node ≥ 18）：

```text
node scripts/link-skill.mjs status
node scripts/link-skill.mjs <skill> main
node scripts/link-skill.mjs <skill> <worktree-path>
node scripts/link-skill.mjs <skill> main --link-dir <dir>
```

- 默认链接目录：`<repo>/.claude/skills/`。
- `status`：列出每个链接及其目标，并标记目标是否存在。
- `main`：目标为 `<repo>/skills/<skill>`。
- `<worktree-path>`：目标为 `<worktree-path>/skills/<skill>`；目标必须存在。
- 安全替换：
  - `lstat` 链接路径；只删除链接本身，绝不递归删除目标。
  - Windows 用 junction 或 symlink；POSIX 用 symlink。
  - 如果链接位置是真实目录/文件，拒绝操作并报错。
- `--link-dir` 用于测试，避免动真实的 `.claude/skills/`。
- 成功后打印 `link -> target`；失败退出非零。

**验证**：

- `status` 在真实目录上正确。
- `main` 对 `grill-x` 幂等。
- 临时 link dir + 临时 worktree 往返切换正确；真实链接最后恢复为 `main`。

### 3.4 `AGENTS.md` 改造

**目录树**加入：

- `skills/<name>/tests/`：可选，入库的 CI 夹具（不属于运行结构）。
- 根 `scripts/check.mjs`、`scripts/link-skill.mjs`。
- `.github/workflows/ci.yml`。
- 保留 `_dev/`、`_sources/`、`drafts/` 的现有语义。

**删除**：

- “轮”作为独立概念；“一轮可含多条分支”；“验证窗口期”等本仓库自造术语。
- 任何把 `docs/adr` 或根 `CONTEXT.md` 当仓库约定的表述（已不存在）。

**保留**：

- 升格的 100% rename、与内容修剪解耦、test-log 先提交、Parked 去向。
- 两段门的实质：脚本/夹具验证 + 真实使用/用户认可。
- `_dev/` 常驻本地、不入库、永不删除；drafts 的 `_` 目录入库、升格时仅丢弃本 skill 的 `_` 目录。
- CHANGELOG 唯一持久记录、关闭条目、没有 close 提交。
- 分支命名、Conventional Commits、文档/小修直接提交的例外。

**迭代节目标文本（草稿，执行时以本文件为准）**：

```markdown
## 已升格 skill 的迭代（GitHub Flow）

- 一个工作项 = 一条分支 = 一个 PR = 一次行为变更；`_dev/plan.md` 一份、`_dev/test-log.md` 一节。
- 从最新 `main` 创建 `<skill>/<topic>` 分支，开 draft PR。
- 流程：
  1. 写 `plan.md`，定义验收标准。
  2. 提交；`node scripts/check.mjs` 通过（门槛 1 / CI）。
  3. `node scripts/link-skill.mjs <skill> <worktree>`；在真实项目中使用（门槛 2 / UAT）。
  4. 真实使用通过 + 用户认可后，`node scripts/link-skill.mjs <skill> main`，merge PR，删除分支。
  5. `test-log.md` 写关闭条目；没有 close 提交。
- 缺陷：同一分支继续提交，重跑门槛 1，重新验收。
- 新需求：新工作项/新分支，不塞进当前分支。
- 同一 skill 同时只开一条分支（WIP limit）；不同 skill 可并行。
- 门槛 1（CI）：结构/打包、frontmatter、相对链接、脚本语法、夹具回归、仓库不变式；不调用 LLM。
- 门槛 2（UAT）：真实使用 + transcript/输出检查 + 用户认可。
```

**分支与提交节目标文本**：

```markdown
## 分支与提交

- `main` 始终可用；行为变更走短分支 + PR。
- 分支命名：`<skill>/<topic>`（kebab-case，不加 `feat/`/`fix/` 前缀）；repo 级流程变更用 `repo/<topic>`。
- 一次开发脉冲一条分支；merge 后删除，已合并分支名不复用。
- 提交信息用 Conventional Commits；scope 与 skill 名一致。
- 文档/小修可直接提交 `main`。
```

**约定节目标文本**：

```markdown
## 约定

- 开发期文件一律放进 `_` 目录；`_` 目录不属于运行结构。入库语义见目录树。
- `tests/` 是入库的 CI 夹具，不属于运行结构。
- `skills/` 下的新增或变更，必须在同次内容提交中同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段（`drafts/` 不记）。
```

**升格流程**：保持现有语义，只把最后一步改成“在 `feat/<name>` 分支上完成升格提交，CI 通过、UAT 认可后 merge”。`drafts/` 的暂存方式保持现状，不扩大到完全 GitHub Flow。

### 3.5 CHANGELOG 与提交

**CHANGELOG `[Unreleased]`**：

- Added：`scripts/check.mjs`、`skills/session-log/tests/`、`scripts/link-skill.mjs`、`.github/workflows/ci.yml`。
- Changed：`AGENTS.md` 迭代流程改为 GitHub Flow + staging/UAT；工作项 = 分支 = PR；门槛 1/2 定义；junction 工作流；同一 skill 同时只开一条分支。

**提交计划**（本文件所在分支）：

1. `docs: add GitHub Flow migration plan`（本文件，已完成）
2. `test(ci): add repo checks and session-log fixtures`
3. `feat(tooling): add skill junction switch helper`
4. `docs: adopt GitHub Flow for skill iteration`

**合并**：用这个分支本身 dogfood 新流程——开 PR，CI 绿，self-review，merge 到 `main`，删除分支。`df40683` 的删除提交已在 `main` 上，不在本分支重复。

### 3.6 验证

- `node scripts/check.mjs` 全绿。
- `node skills/session-log/tests/run.mjs` 全绿，重复运行结果一致。
- `node scripts/link-skill.mjs status` 显示两个 skill 都指向 `skills/<name>`。
- 临时 link dir/worktree 往返测试通过；真实链接恢复。
- `git diff --check`、`.githooks/pre-commit` 通过。
- `git diff --stat main...HEAD` 只包含流程/工具/测试文件，不包含 `SKILL.md` 或 `scripts/*.mjs` 的行为改动。
- CI 工作流在 PR 上实际跑通（若仓库已推送并启用 Actions）；否则本地命令等价通过。

### 3.7 边界与默认

- `drafts/` 暂存方式不变（仍入库到 `main`）；本次不扩大到完全 GitHub Flow。
- 文档/小修仍可直接提交 `main`。
- CI 不调用 LLM；行为质量只由门槛 2 负责。
- 测试放在 `skills/<name>/tests/`，入库；不属于运行结构。
- 默认把 `session-logs/` 加入 `.gitignore`（`export.mjs` 的默认输出目录）。
- GitHub Actions 现在加入；若仓库不推送/不开 PR，本地 `check.mjs` 是等价的门槛 1。
- 不引入 npm 依赖；Node ≥ 18（当前 v22.18.0）。

## 4. 风险与取舍

- **分支生命周期变长**：分支要活到 UAT 结束；期间 `main` 可能前进。需要时把 `main` rebase/merge 进分支，重跑 CI。
- **junction 是全局切换**：验收期间所有使用该 skill 的项目都会看到分支版本；验收结束必须切回 `main`。
- **纯文本 skill 的 CI 很薄**：`grill-x` 只能做结构/链接检查，行为质量几乎全部由门槛 2 承担。
- **CI 维护成本**：检查必须快、确定性、无 LLM；否则会变成负担。
- **`drafts/` 仍是局部例外**：它不影响 `main` 可用性，但不是纯 GitHub Flow；这是有意保留的范围边界。
- **本文件会增加一个 `docs/` 文档**：作为设计记录保留；如果不想保留，执行完成后可单独删除。

## 5. 审阅要点

请审阅者重点检查：

1. “工作项 = 分支 = PR”是否真的成立，还是只是把旧模型换了个名字。
2. 合入前 UAT + junction 切换在 Windows/本地 symlink 环境下是否可行。
3. CI 检查的范围是否合理：是否漏掉关键检查，或包含了不该由 CI 承担的行为测试。
4. `session-log` 的 golden 测试是否会固化现有 bug。
5. `AGENTS.md` 的目标文本是否保留了所有现有操作性决策。
6. 提交/合并顺序、分支删除、junction 恢复是否有遗漏。
7. `drafts/` 保持现状的边界是否可以接受。

## 6. 执行注意事项（给新 session）

- 先完整读本文件；不要重新设计流程。
- 确认当前分支是 `repo/github-flow`，基线是 `main @ df40683`。
- 按 3.1 → 3.6 顺序执行；每一步先跑验证再进入下一步。
- 如果检查发现现有 bug，先报告，不夹带修复；经用户确认后另开工作项。
- 如果执行中偏离本文件，在本文件追加“执行偏差”一节，并在提交信息中说明。
- 提交前跑 `git diff --check` 和 `.githooks/pre-commit`。
- 未获用户指示不要 push；merge 前确认所有门槛通过。
