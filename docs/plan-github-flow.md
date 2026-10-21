# GitHub Flow 迁移：说明与执行计划

- **状态**：已执行（2026-10-21；执行偏差见 §7）。
- **日期**：2026-10-21
- **分支**：`repo/github-flow`
- **基线**：`main @ df40683`（已删除 grill-x docs-mode 产物）
- **执行方式**：在一个新 session 中按本文件执行；先读 §0.4。
- **范围**：只改流程与工具；不改任何 skill 的行为。

## 0. 背景与决策

### 0.1 为什么要改

当前 `AGENTS.md` 用“轮”作为迭代单位，但“一轮”可以跨多条分支。这个模型：

- 与“一个工作项 = 一条分支 = 一个 PR”的常见认知相悖；
- 与 GitHub Flow 的默认模型相悖；
- 需要读者先理解一个本仓库自造的概念，增加人和 LLM 的误读概率。

### 0.2 目标模型

采用**方案 B：GitHub Flow + staging/UAT**，并按 2026-10-21 共识修订为“PR 持久记录 + worktree 工作副本”。

- 一个工作项 = 一条分支 = 一个 PR = 一次行为变更。
- **门槛 1（CI）** 在合入前跑确定性检查。
- **门槛 2（UAT）** 在合入前、于声明的 UAT 场地真实使用；场地二选一：分支 worktree 会话，或链接到该 worktree 的外部 sandbox。
- 主检出的 `.claude/skills/<skill>` 始终指向 `skills/<skill>`（main），不参与 UAT 切换。
- 两道门都通过后才 merge（rebase）到 `main`；合入后删除分支与 worktree；若用了 sandbox，链接指回 `skills/<skill>`。
- 持久记录是 PR 正文（plan）、PR 评论（UAT）与 `CHANGELOG.md`；worktree 内 `_dev/` 只是随分支删除的工作副本。

```text
main    ──●──────────────────────────────────────────────────●────▶
           \                                                /
            ●──●──●── CI ✅ ── UAT ✅ ── 认可 ── rebase merge
            branch S/T
            │    │         │             │
            │    │         │             └ UAT 结论 → PR 评论
            │    │         └ UAT 链接：worktree 自链 或 sandbox → worktree skill
            │    └ 首个提交 + draft PR（正文 = plan）
            └ worktree: .worktree/S/T
```

### 0.3 已完成的决策

- 方案 B 已获用户同意。
- junction 切换工具已获用户同意。
- 删除 `CONTEXT.md` 与 `docs/adr/` 已获用户同意并完成（`df40683`）。它们由 grill-x 的 docs 模式在开发 `session-log` 时产出，不是仓库约定；该行为记为 grill-x 的缺陷，本文不再处理。
- 2026-10-21 grill-x 会话确认 Q1-Q7；见 §0.4。
- 本文件只做计划与备份；不执行。

### 0.4 2026-10-21 共识（Q1-Q7）

| # | 选择 | 落到的规则 |
|---|---|---|
| Q1 | a | UAT 场地按工作项声明：能在本仓库真实使用的用 worktree 会话；需要独立素材的用链接的 sandbox；主检出链接不切换。 |
| Q2 | a，经 Q3/Q6 修订 | 去掉**常驻**的 `skills/<skill>/_dev/`；保留 **per-branch 工作副本**（worktree 内，gitignored，随 worktree 删除），它不是记录。 |
| Q3 | a | 混合记录：PR 正文 = plan，PR 评论 = UAT，`CHANGELOG.md` = 仓库内持久摘要；worktree 内 `skills/<skill>/_dev/{plan,test-log}.md` 是工作副本。worktree 路径 `.worktree/<skill>/<topic>`，镜像分支名。 |
| Q4 | a | 自动化放 `scripts/workitem.mjs` + `AGENTS.md` 触发规则；不加新 skill；gh 细节全部封装在脚本里。 |
| Q5 | a | `plan save` 自动创建：从最新 `main` 建 branch/worktree、写本地 plan、空提交、push、开 draft PR。 |
| Q6 | a | 每轮 UAT 后自动双写：`_dev/test-log.md` 追加 + PR 评论；本地先写，远端失败留 pending，`sync` 重试。 |
| Q7 | a | fake-gh + 临时裸仓库集成测试，放 `scripts/tests/run.mjs`，由 `check.mjs` 自动发现并执行。 |

共识附带的默认项：

- `workitem.mjs` 零依赖、Node ≥ 18、幂等。
- 本地优先；gh 失败只 warning，`sync` 重试。
- 权限只允许 `Bash(node scripts/workitem.mjs *)`、`check.mjs`、`link-skill.mjs`；不直接允许 `Bash(gh *)`。默认放 `.claude/settings.json`（入库）；不想入库就放 `settings.local.json`。
- 本轮自动化到 `start`（随 `plan save`）+ `plan save` + `uat save`；merge、删 worktree、链接指回仍手动；CHANGELOG 由 agent 起草、用户确认。
- `workitem.mjs` 进 `check.mjs` 的 `node --check` 与 CHANGELOG。
- `plan save` 先检查 `main` 与 `origin/main`；本地领先时提示先 push main（当前本地 main 领先 7 个提交）。
- merge 默认 rebase；首个提交默认空提交；self-review = 看 diff + 留评论（GitHub 不允许自 approve）。
- `skills/**/_dev/` 的 gitignore 规则保留；`skills/**/_sources/` 不在本轮变更内；`drafts/` 语义不变。
- 没有 close 提交。

## 1. 目标流程

### 1.1 定义

| 单位 | 定义 |
|---|---|
| **工作项** | 一个变更意图 + 验收标准；对应一个 draft PR：正文 = plan，评论 = UAT；worktree 内 `_dev/` 是工作副本 |
| **分支** | 工作项的实现；从最新 `main` 创建，命名 `<skill>/<topic>` |
| **PR** | 分支的审阅/合入载体；从首个提交开 draft PR；solo 仓库可 self-review（GitHub 不允许自 approve，留评论即可）；merge 后 PR 保留 |
| **提交** | 分支上的一个记录点 |
| **门槛 1（CI）** | 合入前的确定性检查：结构/打包、frontmatter、相对链接、脚本语法、夹具回归、仓库不变式；不调用 LLM |
| **门槛 2（UAT）** | 合入前的非确定性验证：在声明的 UAT 场地真实使用，检查 transcript/输出，结论记入 PR 评论与 `_dev/test-log.md`，并经用户认可/豁免 |
| **UAT 场地** | 分支 worktree 会话，或链接到该 worktree 的外部 sandbox；在 PR 正文声明 |
| **记录** | 持久 = PR 正文/评论 + `CHANGELOG.md`；工作副本 = worktree `_dev/`（gitignored，随 worktree 删除） |

`main` 始终可用。一个工作项对应一条分支和一个 PR；不再使用“轮”作为独立概念。

### 1.2 流程

```text
1. 讨论方案；说“保存为 plan” → node scripts/workitem.mjs plan save
   ├─ 从最新 main 建 .worktree/<skill>/<topic> 和分支 <skill>/<topic>
   ├─ 写 skills/<skill>/_dev/plan.md
   ├─ 空提交 + push + draft PR（正文 = plan）
   └─ gh 失败：本地文件已写，留 pending；sync 重试
2. 实现；每次 push 跑 node scripts/check.mjs（门槛 1）
3. 建 UAT 链接（二选一）
   ├─ worktree 场地：<worktree>/.claude/skills/<skill> → <worktree>/skills/<skill>
   └─ sandbox 场地：<sandbox>/.claude/skills/<skill> → <worktree>/skills/<skill>
4. 真实使用（门槛 2）
   ├─ 每轮结束：node scripts/workitem.mjs uat save ...
   │   └─ 追加 _dev/test-log.md + 发 PR 评论
   ├─ 发现缺陷 → 同分支继续提交，回到 2，重新验收
   └─ 发现新需求 → 不塞进本分支；新工作项/新分支
5. 关闭前：CHANGELOG 吸入结论 → node scripts/workitem.mjs uat save --final
   → CI 绿 → self-review
6. merge（rebase）→ 删除分支/worktree → 若用 sandbox，链接指回 main
```

没有 close 提交；merge 本身就是关闭。

### 1.3 缺陷 vs 新需求

- **缺陷**：没有达到 plan 已声明的意图。同一分支继续提交，重跑门槛 1，重新验收。
- **新需求**：超出 plan 的意图。关闭当前工作项后，开新工作项/新分支。

### 1.4 串行迭代

同一 skill 同时只开一条分支（WIP limit = 1）；不同 skill 可以并行。

### 1.5 UAT 链接

```text
UAT 期间（二选一）：
  worktree 场地：<worktree>/.claude/skills/<skill> → <worktree>/skills/<skill>
  sandbox 场地：<sandbox>/.claude/skills/<skill> → <worktree>/skills/<skill>

主检出（始终）：
  <repo>/.claude/skills/<skill> → <repo>/skills/<skill>

合入后：
  git worktree remove <worktree>
  若用 sandbox：
    node scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills
```

由 `scripts/link-skill.mjs` 执行，接口见 §3.3。主检出的链接不切换；只有 UAT 场地的链接在分支期间指向 worktree skill。

### 1.6 记录模型

| 内容 | 持久副本 | 工作副本 |
|---|---|---|
| plan | draft PR 正文 | worktree `skills/<skill>/_dev/plan.md` |
| UAT | PR 评论 + `CHANGELOG.md` | worktree `skills/<skill>/_dev/test-log.md` |
| CI | PR checks | — |

- worktree 内 `_dev/` 被 gitignore，随 worktree 删除；主检出没有永久的 `skills/<skill>/_dev/`。
- `drafts/<name>/_dev/`、`_sources/` 仍入库，升格时丢弃；本轮不改。
- `skills/<name>/tests/` 是入库的 CI 夹具，合入 main 后保留；与 UAT 产物不是一回事。
- `skills/**/_sources/` 不在本轮变更内；`skills/**/_dev/` 的 gitignore 规则保留。

## 2. 当前状态

- 分支 `repo/github-flow` 从 `main @ df40683` 创建；本文件是其第一个提交（`c97e5fe`）。
- `skills/grill-x/`：纯文本 skill，无脚本。
- `skills/session-log/`：脚本型 skill，`claude-code.mjs`（873 行）+ `export.mjs`（149 行），七个命令的统一接口。
- 仓库没有 `.github/`、`package.json`、测试夹具、`scripts/`；门槛 1 目前只是手工跑脚本。
- Node `v22.18.0` 可用。
- 本地 `.claude/skills/grill-x`、`.claude/skills/session-log` 当前是指向 `skills/<name>` 的 symlink；`.claude/skills/` 被 gitignore。
- `gh` 2.100.0 已登录（HelioAB，`repo`/`workflow` scope）；仓库为 private；`gh pr create`/`edit` 支持 `--draft`、`--body-file`。
- 还没有 PR；本地 `main` 领先 `origin/main` 7 个提交；执行前先检查，若仍领先则经用户确认后推送，避免 PR 带入无关提交。
- `.worktree/` 现有 `feat/flashcard-skills`、`feat/init-project` 两个草案 worktree；它们没有 `.claude/skills` 链接。
- `.claude/settings.local.json` 只允许 `Bash(git *)`；尚无 `.claude/settings.json`。
- `skills/` 下没有 `_dev/`；`drafts/` 的 `_dev` 在 flashcard worktree 里，主检出无 `drafts/`。

## 3. 执行项

### 3.0 分支与本文档（已完成）

- 创建 `repo/github-flow` 分支。
- 提交本文件（`c97e5fe`）。
- 2026-10-21 共识修订作为下一个 docs 提交（见 §3.6）。

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
  - 对 `skills/`、`scripts/`、`scripts/tests/` 下所有 `.mjs` 跑 `node --check`。
- 夹具测试：
  - 若存在 `skills/<name>/tests/run.mjs`，执行 `node <tests/run.mjs>`，透传退出码。
  - 若存在 `scripts/tests/run.mjs`，执行 `node scripts/tests/run.mjs`，透传退出码。
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

### 3.3 UAT 链接工具

**新增 `scripts/link-skill.mjs`**（零依赖，Node ≥ 18）：

```text
node scripts/link-skill.mjs status [--link-dir <dir>]
node scripts/link-skill.mjs <skill> main [--link-dir <dir>]
node scripts/link-skill.mjs <skill> <worktree-path> [--link-dir <dir>]
```

- 默认链接目录：`<repo>/.claude/skills/`。
- `status`：列出每个链接及其目标，并标记目标是否存在；`--link-dir` 用于检查 worktree/sandbox。
- `main`：目标为**主 worktree**（`git worktree list` 第一项，不是当前 worktree）的 `skills/<skill>`。
- `<worktree-path>`：目标为 `<worktree-path>/skills/<skill>`；目标必须存在。
- 安全替换：
  - `lstat` 链接路径；只删除链接本身，绝不递归删除目标。
  - Windows 用 junction 或 symlink；POSIX 用 symlink。
  - 如果链接位置是真实目录/文件，拒绝操作并报错。
- 成功后打印 `link -> target`；失败退出非零。

**验证**：

- `status` 在真实目录上正确。
- `main` 对 `grill-x` 幂等；主检出的链接不被改动。
- 临时 link dir + 临时 worktree 往返切换正确；真实链接最后恢复为 `main`。
- worktree 自链接：`<worktree>/.claude/skills/<skill>` → `<worktree>/skills/<skill>`。
- sandbox 往返：`<sandbox>/.claude/skills/<skill>` → worktree skill；merge 后用 `main --link-dir <sandbox>/.claude/skills` 指回主 worktree。
- 首次把 sandbox 的复制目录换成链接前，先手动删掉旧目录；工具拒绝覆盖真实目录。

### 3.4 工作项自动化

**新增 `scripts/workitem.mjs`**（零依赖，Node ≥ 18）：

```text
node scripts/workitem.mjs plan save [--skill <name>] [--topic <topic>] [--title <title>]
node scripts/workitem.mjs uat save --venue <worktree|sandbox> --session <id> --result <pass|findings> [--findings <text>]
node scripts/workitem.mjs uat save --final --approval <yes|waiver> [--note <text>]
node scripts/workitem.mjs sync
node scripts/workitem.mjs status
```

- 测试注入：`--repo <path>`（主检出）、`--gh <path>` 或 `GH_BIN`（fake gh）；默认从 `git worktree list` 找主检出，gh 用 PATH 中的 `gh`。
- `plan save`：
  - 解析 skill/topic；若当前已在 `.worktree/<skill>/<topic>` 内，使用当前 worktree；否则从最新 `main` 创建。
  - 写 `skills/<skill>/_dev/plan.md`（确保 `_dev` 存在；gitignored）。
  - 若没有 PR：`git commit --allow-empty -m "chore(<skill>): start <topic>"`、`git push -u origin <skill>/<topic>`、`gh pr create --draft --title ... --body-file <plan>`。
  - 若已有 PR：`gh pr edit <N> --body-file <plan>`。
  - 打印 worktree 路径与 PR URL。
  - 先检查 `main` 与 `origin/main`；本地领先时提示先 push main，避免 PR 带入无关提交。
- `uat save`：
  - 追加一节到 `skills/<skill>/_dev/test-log.md`（日期、venue、session、result、findings）。
  - 用同一节内容 `gh pr comment <N> --body-file <section>`。
  - 本地先写；gh 失败写 `_dev/sync.json` pending，退出码 0 但打印 warning。
  - `--final` 写最终 approval/waiver 评论；不 merge。
- `sync`：重试 pending 的 PR 正文/评论；成功清 pending。
- `status`：分支、worktree、PR、pending 状态。
- 幂等：
  - 重复 `plan save` 只更新同一 PR 正文；
  - 重复 `uat save` 用 section hash 去重，不重复评论；
  - 不重复建 PR。
- 安全：
  - 只做空提交；不 force push；不提交 `_dev`；不改 skill 行为；所有 gh 调用在脚本内部。
  - 当前目录属于另一个 worktree 时拒绝或显式切换，不猜。
- `AGENTS.md` 触发规则：
  - 用户说“保存为 plan/更新 plan/记录方案” → `plan save`；
  - 每轮 UAT 后 → `uat save`；
  - 关闭前 → `uat save --final`；
  - 有 pending 或不确定时 → `sync` / `status`。
- 权限：
  - 在 `.claude/settings.json`（默认，入库）或 `.claude/settings.local.json` 增加：
    - `Bash(node scripts/workitem.mjs *)`
    - `Bash(node scripts/check.mjs *)`
    - `Bash(node scripts/link-skill.mjs *)`
  - 不直接允许 `Bash(gh *)`；gh 只经脚本调用。

**新增 `scripts/tests/`**：

- `run.mjs`：零依赖测试入口，由 `check.mjs` 自动发现。
- `fake-gh.mjs`：记录调用参数并按需返回 JSON/URL；由 `--gh`/`GH_BIN` 注入。
- 用临时裸仓库 + clone 构造 test repo；`--repo` 指向它。
- 覆盖：
  1. `plan save` 建 worktree/分支/空提交/PR 正文；
  2. 第二次 `plan save` 走 `gh pr edit`，不重复建 PR；
  3. `uat save` 追加 `_dev/test-log.md` 并 `gh pr comment`；
  4. 重复同一 UAT section 不重复评论；
  5. gh 失败时本地文件已写、留下 pending；`sync` 重试成功；
  6. `status` 输出分支/worktree/PR/pending；
  7. 缺 skill/topic、目标 worktree 冲突等错误路径返回非零；
  8. 测试后 `git status` 没有 `_dev`。

### 3.5 `AGENTS.md` 改造

**目录树**改为：

```text
.
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── references/
│       ├── scripts/
│       ├── tests/          # 可选：入库的 CI 夹具
│       └── _dev/           # 仅 worktree 内；gitignored 的 per-branch 工作副本
├── drafts/
│   └── <skill-name>/
│       ├── _sources/       # 入库，升格时丢弃
│       └── _dev/           # 入库，升格时丢弃
├── scripts/
│   ├── check.mjs
│   ├── link-skill.mjs
│   ├── workitem.mjs
│   └── tests/
├── .github/workflows/ci.yml
└── .claude/settings.json
```

- `skills/<name>/_dev/` 只在分支 worktree 中存在；主检出没有永久的 `_dev`。
- `.claude/skills/` 是本地链接目录，gitignored，不在树中展开。
- `skills/**/_sources/` 不在本轮变更内；`drafts/` 的 `_dev`、`_sources` 语义不变。

**迭代节目标文本**：

```markdown
## 已升格 skill 的迭代（GitHub Flow）

- 一个工作项 = 一条分支 = 一个 PR = 一次行为变更。
- 从最新 `main` 建 `<skill>/<topic>` 分支和 `.worktree/<skill>/<topic>` worktree；draft PR 正文 = plan。
- `skills/<skill>/_dev/` 是当前 worktree 内的 per-branch 工作副本（gitignored，随 worktree 删除），不是记录。
- 持久记录：PR 正文（plan）、PR 评论（UAT）、`CHANGELOG.md`（仓库内唯一持久摘要）。
- 流程：
  1. 讨论方案；说“保存为 plan” → `node scripts/workitem.mjs plan save`（建分支/worktree、写 `_dev/plan.md`、空提交 + push、开 draft PR）。
  2. 实现；每次 push 跑 `node scripts/check.mjs`（门槛 1）。
  3. 建 UAT 链接：worktree 自链，或 sandbox 的 `.claude/skills/<skill>` 指向 worktree skill。
  4. UAT（门槛 2）：真实使用；每轮结束运行 `node scripts/workitem.mjs uat save`（`_dev/test-log.md` + PR 评论）。
  5. 缺陷：同分支提交，重跑门槛 1，重新验收。新需求：新工作项。
  6. 关闭前：CHANGELOG 吸入结论；`node scripts/workitem.mjs uat save --final`；CI 绿；self-review。
  7. merge（rebase）→ 删除分支/worktree；若用 sandbox，链接指回 `skills/<skill>`。没有 close 提交。
- 同一 skill 同时只开一条分支；不同 skill 可并行。
- 门槛 1（CI）：结构/打包、frontmatter、相对链接、脚本语法、夹具回归、仓库不变式；不调用 LLM。
- 门槛 2（UAT）：声明的 UAT 场地真实使用 + 输出检查 + 用户认可/豁免。
```

**工作项自动化节目标文本**：

```markdown
## 工作项自动化

- `node scripts/workitem.mjs plan save`：写 `_dev/plan.md`，建/更新 draft PR 正文；工作项不存在时自动创建分支/worktree。
- `node scripts/workitem.mjs uat save ...`：追加 `_dev/test-log.md`，发 PR 评论；每轮 UAT 后自动运行。
- `node scripts/workitem.mjs uat save --final ...`：关闭前的最终认可/豁免评论。
- `node scripts/workitem.mjs sync`：重试失败的远端同步。
- `node scripts/workitem.mjs status`：分支/worktree/PR/pending 状态。
- 用户说“保存为 plan/更新 plan/记录方案”时运行 `plan save`；本地优先，gh 失败留 pending。
- 权限只允许 `node scripts/*.mjs`；不要直接允许 `gh`。
```

**分支与提交节目标文本**：

```markdown
## 分支与提交

- `main` 始终可用；一个工作项 = 一条分支 = 一个 PR。
- 分支命名：`<skill>/<topic>`（kebab-case，不加 `feat/`/`fix/` 前缀）；repo 级流程变更用 `repo/<topic>`。
- 从最新 `main` 创建；merge 用 rebase；merge 后删除分支与 worktree；已合并分支名不复用。
- 提交信息用 Conventional Commits；scope 与 skill 名一致。
- 文档/小修可直接提交 `main`。
```

**约定节目标文本**：

```markdown
## 约定

- `skills/<skill>/_dev/` 只在 worktree 中存在，是 gitignored 的 per-branch 工作副本；不入库、不当记录，随 worktree 删除。
- `drafts/` 下的 `_dev/`、`_sources/` 入库（升格证据），升格时整目录丢弃。
- `skills/<skill>/tests/` 入库，CI 夹具，不属于运行结构。
- `skills/` 下新增或变更，必须在同次内容提交中同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段（`drafts/` 不记）。
- `CHANGELOG.md` 是仓库内唯一持久摘要；PR 正文/评论是远程持久记录。
```

**升格流程**：保持现有三步（先提交 test-log 未提交修改；`git mv` 运行结构、丢弃 `_dev`/`_sources`；CHANGELOG 记升格与 Parked）。只把最后一步改成“在 `feat/<name>` 分支上完成升格提交，开 draft PR，CI 通过、UAT 认可后 merge”。`drafts/` 仍按现有语义入库。

### 3.6 CHANGELOG 与提交

**CHANGELOG `[Unreleased]`**：

- Added：`scripts/check.mjs`、`scripts/link-skill.mjs`、`scripts/workitem.mjs`、`scripts/tests/`、`.claude/settings.json`、`skills/session-log/tests/`、`.github/workflows/ci.yml`。
- Changed：`AGENTS.md` 迭代流程改为 GitHub Flow + staging/UAT；一个工作项 = 分支 = PR；PR 正文/评论 + CHANGELOG 为持久记录；worktree `_dev/` 为 per-branch 工作副本；UAT 场地与链接；`workitem` 自动化；同一 skill 同时只开一条分支。

**提交计划**（本文件所在分支）：

1. `docs: add GitHub Flow migration plan`（已完成，`c97e5fe`）
2. `docs: revise migration plan for PR records and workitem automation`（本修订）
3. `test(ci): add repo checks and session-log fixtures`
4. `feat(tooling): add skill junction switch helper`
5. `feat(tooling): add work-item save automation and fake-gh tests`
6. `docs: adopt GitHub Flow for skill iteration`

**合并**：用这个分支本身 dogfood 新流程——开 PR，CI 绿，self-review，rebase merge 到 `main`，删除分支。`df40683` 的删除提交已在 `main` 上，不在本分支重复。`workitem.mjs` 的首次真实使用放在迁移后的第一个 skill 工作项。

### 3.7 验证

- `node scripts/check.mjs` 全绿。
- `node skills/session-log/tests/run.mjs` 全绿，重复运行结果一致。
- `node scripts/tests/run.mjs` 全绿，重复运行结果一致；fake-gh 用例覆盖 plan/uat/sync/status。
- `node scripts/link-skill.mjs status` 显示两个 skill 都指向 `skills/<name>`。
- worktree 自链、sandbox 链接与 merge 后指回 main 的往返测试通过；真实链接恢复。
- `git diff --check`、`.githooks/pre-commit` 通过。
- `git diff --stat main...HEAD` 只包含流程/工具/测试文件，不包含 `SKILL.md` 或 `scripts/*.mjs` 的行为改动。
- CI 工作流在 PR 上实际跑通（若仓库已推送并启用 Actions）；否则本地命令等价通过。
- 迁移后的第一个 skill 工作项真实 dogfood `workitem plan save` / `uat save` / `sync`，结论记入该工作项的 PR 与 CHANGELOG。

### 3.8 边界与默认

- `drafts/` 暂存方式不变（仍入库到 `main`）；本次不扩大到完全 GitHub Flow。
- 文档/小修仍可直接提交 `main`。
- CI 不调用 LLM；行为质量只由门槛 2 负责。
- 测试放在 `skills/<name>/tests/`，入库；不属于运行结构。
- 默认把 `session-logs/` 加入 `.gitignore`（`export.mjs` 的默认输出目录）。
- GitHub Actions 现在加入；若仓库不推送/不开 PR，本地 `check.mjs` 是等价的门槛 1。
- 不引入 npm 依赖；Node ≥ 18（当前 v22.18.0）。
- `workitem.mjs` 需要 `gh` 已登录；离线时本地优先，`sync` 重试。
- `skills/**/_dev/` 的 gitignore 规则保留；主检出没有永久的 `skills/<skill>/_dev/`。
- `skills/**/_sources/` 不在本轮变更内。
- merge 默认 rebase；首个提交默认空提交；self-review 是看 diff + 留评论。
- 权限默认放 `.claude/settings.json`（入库）；不想入库就放 `settings.local.json`。
- 本轮自动化不到 merge/清理；CHANGELOG 由 agent 起草、用户确认。

## 4. 风险与取舍

- **分支生命周期变长**：分支要活到 UAT 结束；期间 `main` 可能前进。需要时把 `main` rebase/merge 进分支，重跑 CI。
- **junction 不是全局切换**：主检出的 `.claude/skills/<skill>` 始终指 main；只有 UAT 场地的链接指向 worktree skill。共享 sandbox 里其他使用同一 skill 的测试会看到分支版本，需要隔离时用单独 sandbox。
- **纯文本 skill 的 CI 很薄**：`grill-x` 只能做结构/链接检查，行为质量几乎全部由门槛 2 承担。
- **CI 维护成本**：检查必须快、确定性、无 LLM；否则会变成负担。
- **`drafts/` 仍是局部例外**：它不影响 `main` 可用性，但不是纯 GitHub Flow；这是有意保留的范围边界。
- **本文件会增加一个 `docs/` 文档**：作为设计记录保留；如果不想保留，执行完成后可单独删除。
- **`workitem.mjs` 依赖 gh/网络**：本地优先 + pending/sync 缓解；PR 不存在时只能本地保存。
- **工作副本可能漂移**：`_dev/plan.md`/`test-log.md` 与 PR 正文/评论可能不一致；`sync` 和关闭前检查负责收敛。
- **空提交噪音**：为开 draft PR 需要首个空提交；它只出现一次，不改变代码。
- **权限/设置**：自动化依赖 Claude Code 的 allow 规则；没有规则会弹权限，破坏“无需手动”的体验。
- **PR 是远程记录**：本地 `_dev` 不是权威副本；worktree 删除后只剩 PR 与 CHANGELOG。

## 5. 审阅要点

请审阅者重点检查：

1. “工作项 = 分支 = PR”是否真的成立，还是只是把旧模型换了个名字。
2. UAT 场地按工作项声明、主检出不切换、sandbox 链接指回，是否覆盖 Windows/本地 symlink 环境。
3. CI 检查的范围是否合理：是否漏掉关键检查，或包含了不该由 CI 承担的行为测试。
4. `session-log` 的 golden 测试是否会固化现有 bug。
5. `AGENTS.md` 的目标文本是否保留了所有现有操作性决策（升格、两段门、CHANGELOG、分支命名）。
6. `workitem.mjs` 的 fake-gh 测试是否真正覆盖创建、更新、幂等、失败重试；是否会在测试中碰真实 PR。
7. 提交/合并顺序、分支删除、worktree 清理、sandbox 链接恢复是否有遗漏。
8. `drafts/` 保持现状的边界是否可以接受。
9. 权限规则与 gh 依赖是否让自动化在你的机器上真正“无需手动”。

## 6. 执行注意事项（给新 session）

- 先完整读本文件；不要重新设计流程。
- 确认当前分支是 `repo/github-flow`，基线是 `main @ df40683`。
- 先检查本地 `main` 与 `origin/main`；若本地领先（当前领先 7 个提交），提示用户确认后再推送，避免 PR 带入无关提交。
- 确认 `gh auth status` 正常；仓库为 private。
- 按 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 顺序执行；每一步先跑验证再进入下一步。
- 实现顺序：check → session-log 测试 → link-skill → workitem → AGENTS/CHANGELOG；workitem 的 fake-gh 测试先于 AGENTS 的触发规则。
- 如果检查发现现有 bug，先报告，不夹带修复；经用户确认后另开工作项。
- 如果执行中偏离本文件，在本文件追加“执行偏差”一节，并在提交信息中说明。
- 提交前跑 `git diff --check` 和 `.githooks/pre-commit`。
- 未获用户指示不要 push；merge 前确认所有门槛通过。
- 迁移后的第一个 skill 工作项真实 dogfood `workitem.mjs`；在此之前不要宣称自动化已验证。

## 7. 执行偏差

- 2026-10-21：`scripts/link-skill.mjs` 增加 `remove <skill> [--link-dir <dir>]`
  子命令（§3.3 未列出）。实测 `git worktree remove --force` 会跟随 worktree
  内的 junction 删除主检出 `skills/<skill>` 的内容；本次验证中已实际发生，
  随后从 HEAD 恢复。`remove` 只删除链接本身；worktree 清理步骤改为先
  `remove` 链接，再 `git worktree remove`。CHANGELOG 与 AGENTS 同步记录。
