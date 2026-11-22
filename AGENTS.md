# AGENTS.md

本文件是本仓库 agent 指令的唯一事实源（single source of truth）。工作流细则已
skill 化，放在 `.claude/skills/` 下；本文件只保留仓库定位、目录结构与流程索引。

## 仓库定位

存放我在真实项目中反复使用、验证过的个人 skills。宁缺毋滥：只有真正用过、确实有效的才留下。

## 目录结构

```text
.
├── skills/<skill-name>/   # 已升格 skill：SKILL.md + 可选 references/、scripts/、tests/（CI 夹具，不属于运行结构）
│   └── _dev/              # 仅分支 worktree 内；gitignored 的 per-branch 工作副本，随 worktree 删除
├── drafts/<skill-name>/   # 开发中 skill：_dev/、_sources/ 入库（升格证据），升格时整目录丢弃
├── .claude/
│   ├── settings.json
│   └── skills/            # 工作流 skill（graduation/、iteration/）入库；其余为本地 junction 链接，gitignored
├── scripts/               # check.mjs（门槛 1）、link-skill.mjs、workitem.mjs、tests/
├── .github/workflows/ci.yml
└── CHANGELOG.md           # 仓库内唯一持久摘要
```

- `skills/<name>/_dev/` 只在分支 worktree 中存在；主检出没有永久的 `_dev`。
- `.claude/skills/` 用 `.claude/skills/*` 整体 ignore + 逐 skill `!` 例外放行入库的
  工作流 skill：本地 junction 链接保持不入库，防止 `git add` 沿链接把主检出内容收进索引。
- `skills/**/_sources/` 不改语义（gitignored、暂无约定）；`drafts/` 的 `_dev`、`_sources` 语义不变。

## 流程索引

| 流程 | 触发词 / 时机 | 规则 |
|---|---|---|
| draft 阶段推进 | `drafts/<name>` 的推进讨论 | [graduation](.claude/skills/graduation/SKILL.md) → references/draft-stage.md |
| 升格 drafts/ → skills/ | 自定门槛达成 + 用户认可 | [graduation](.claude/skills/graduation/SKILL.md) → references/graduate.md |
| 迭代：开始工作项 | 「开始 `<skill>` 的 `<topic>`」「保存为 plan」 | [iteration](.claude/skills/iteration/SKILL.md) → references/plan.md |
| 迭代：UAT（门槛 2） | 「UAT 通过」「UAT 有问题：…」 | [iteration](.claude/skills/iteration/SKILL.md) → references/uat.md |
| 迭代：合并与清理 | 「可以合并」（唯一合并授权） | [iteration](.claude/skills/iteration/SKILL.md) → references/merge-close.md |
| main 同步 | agent 在 UAT/合并前自动，非用户触发词 | [iteration](.claude/skills/iteration/SKILL.md) → references/sync.md |
| workitem 命令 | 触发词映射与权限 | [iteration](.claude/skills/iteration/SKILL.md) → references/workitem-commands.md |
| 仓库级变更 | `repo/<topic>` 分支，不带 worktree | 按同一套门槛（plan/门槛 1/UAT/self-review）由 agent 静默执行，不走 workitem close |

- 门槛 1（本地检查）：`node scripts/check.mjs`——结构、frontmatter、相对链接、脚本语法、
  夹具回归、仓库不变式，覆盖 `skills/` 与入库的工作流 skill；不调 LLM。
- 门槛 2（UAT）：声明的 UAT 场地真实使用 + 输出检查 + 用户认可/豁免。
- 面向用户的触发词与最短用法见 `README.md`；`skills/` 新增或变更必须同次内容提交更新 `CHANGELOG.md` 的 `[Unreleased]` 段（`drafts/` 不记）。
