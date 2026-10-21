# AGENTS.md

本文件是本仓库 agent 指令的唯一事实源（single source of truth）。

## 仓库定位

存放我在真实项目中反复使用、验证过的个人 skills。宁缺毋滥：只有真正用过、确实有效的才留下。

## 目录结构

```text
.
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── references/     # 可选：按需加载的参考资料
│       ├── scripts/        # 可选：skill 调用的脚本
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
- `skills/**/_sources/` 不改语义（gitignored、暂无约定）；`drafts/` 的 `_dev`、`_sources` 语义不变。

## 升格流程（drafts/ → skills/）

前提：`_dev/test-log.md` 里自定的迁移门槛已达成，且经用户认可。

1. test-log 若有未提交修改（通常是最后的门槛验证记录），先单独提交——否则随
   `_dev/` 丢弃后，该记录从未进入过历史。
2. 在 `feat/<name>` 分支上做升格提交 `feat: graduate <name> from drafts/ to skills/`，一次做三件事：
   - `git mv` 运行结构（`SKILL.md`、`references/`、`scripts/`）到 `skills/<name>/`，
     内容不动（保 100% rename）；内容修剪是另一个提交，升格与修改解耦。
   - 整目录丢弃 `_dev/`、`_sources/`。
   - CHANGELOG `[Unreleased]`：Added 段顶部记升格条目（能力一句话 +
     `Graduated from drafts/<name> after <门槛>`）；test-log 中暂不处置的已知边界以
     "Parked, not applied" 记入——这是它们活过 `_dev/` 丢弃的唯一去处。
3. 开 draft PR；门槛 1（CI）通过、门槛 2（UAT）认可后 rebase merge 到 `main`；
   merge 后删除分支/worktree。没有 close 提交。

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
- 链接命令：worktree 自链 `node scripts/link-skill.mjs <skill> <worktree> --link-dir <worktree>/.claude/skills`；
  sandbox 用同一命令改 `--link-dir <sandbox>/.claude/skills`；合入后
  `node scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills` 指回主检出。
- 删除 worktree 前先移除其中的 skill 链接
  （`node scripts/link-skill.mjs remove <skill> --link-dir <worktree>/.claude/skills`）：
  Windows 上递归删除会沿 junction 删到主检出。

## 工作项自动化

- `node scripts/workitem.mjs plan save`：写 `_dev/plan.md`，建/更新 draft PR 正文；工作项不存在时自动创建分支/worktree。plan 正文从 stdin（推荐 heredoc）读取；为空时沿用已有的 `_dev/plan.md`。
- `node scripts/workitem.mjs uat save ...`：追加 `_dev/test-log.md`，发 PR 评论；每轮 UAT 后自动运行。
- `node scripts/workitem.mjs uat save --final ...`：关闭前的最终认可/豁免评论。
- `node scripts/workitem.mjs sync`：重试失败的远端同步。
- `node scripts/workitem.mjs status`：分支/worktree/PR/pending 状态。
- 用户说“保存为 plan/更新 plan/记录方案”时运行 `plan save`；本地优先，gh 失败留 pending。
- sandbox 场地执行 `uat save` 时用 `--repo <worktree>` 指向工作项 worktree。
- 权限只放行 `node scripts/{workitem,check,link-skill}.mjs`；不要直接允许 `gh`。

## 分支与提交

- `main` 始终可用；一个工作项 = 一条分支 = 一个 PR。
- 分支命名：`<skill>/<topic>`（kebab-case，不加 `feat/`/`fix/` 前缀）；repo 级流程变更用 `repo/<topic>`；升格沿用 `feat/<name>`。
- 从最新 `main` 创建；merge 用 rebase；merge 后删除分支与 worktree；已合并分支名不复用。
- 提交信息用 Conventional Commits，scope 与 skill 名一致
  （`session-log/current-locator` ↔ `feat(session-log): ...`）；topic 取 `_dev/plan.md`
  的主题或 CHANGELOG `[Unreleased]` 条目。
- 文档/小修可直接提交 `main`。

## 约定

- `skills/<skill>/_dev/` 只在 worktree 中存在，是 gitignored 的 per-branch 工作副本；不入库、不当记录，随 worktree 删除。
- `drafts/` 下的 `_dev/`、`_sources/` 入库（升格证据），升格时整目录丢弃。
- `skills/<skill>/tests/` 入库，CI 夹具，不属于运行结构。
- `skills/` 下新增或变更，必须在同次内容提交中同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段（`drafts/` 不记）。
- `CHANGELOG.md` 是仓库内唯一持久摘要；PR 正文/评论是远程持久记录。
