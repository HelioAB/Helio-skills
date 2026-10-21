# Helio-skills

The skills I personally use in real projects. One skill per directory under `skills/`.

## 日常开发流程

每个工作项 = 一条分支 = 一个 PR。完整规则见 [AGENTS.md](AGENTS.md)；这里只写用户侧的最短用法。

你不需要记命令，对 agent 说这几句就够了：

| 你说 | 发生什么 |
|---|---|
| 「开始 `<skill>` 的 `<topic>`：`<方案>`」 | 从最新 `main` 建 worktree 和分支，写 plan，开 draft PR |
| 「UAT 通过」/「UAT 有问题：…」 | 把本轮结果写进 `_dev/test-log.md`，并评论到 PR |
| 「同步 main」 | 在 worktree 里 `fetch` + `merge origin/main`（不 force push） |
| 「收尾」 | 更新 CHANGELOG、记录最终认可、确认 `pending: 0`、跑门槛 1、等 CI、self-review |
| 「可以合并」 | `gh pr ready` → rebase merge → 按顺序清理链接/worktree/分支 |

「可以合并」是唯一的合并授权；在你明确说这句话之前，agent 只准备，不 merge。

## 两个门槛

- **门槛 1（CI）**：`node scripts/check.mjs`，也就是 PR 上的 `check`。结构、链接、脚本语法、夹具回归。
- **门槛 2（UAT）**：在声明的场地真实使用，检查输出，由你认可或豁免。

两者都过、`workitem status` 显示 `pending: 0`、self-review 完成，才进入合并。

## 场地与记录

- 日常在 `.worktree/<skill>/<topic>` 里实现；`skills/<skill>/_dev/` 是 gitignored 的本地工作副本，随 worktree 删除。
- 在独立 sandbox 里试用时，用 `node scripts/link-skill.mjs` 把 `.claude/skills/<skill>` 指向 worktree；结束后指回 `main`。
- 仓库级变更用 `repo/<topic>` 分支，不带 worktree，手动走同一套门槛。
- PR 正文 = plan；PR 评论 = 每轮 UAT；`CHANGELOG.md` = 仓库内唯一持久摘要。

## 手动命令（可选）

如果不在 Claude Code 里，或想自己操作：

```bash
node scripts/workitem.mjs plan save < plan.md      # 开始工作项
node scripts/workitem.mjs uat save --venue worktree --session <id> --result pass
node scripts/workitem.mjs status                   # 分支/worktree/PR/pending
node scripts/workitem.mjs sync                     # 重试失败的远端写入
node scripts/check.mjs                             # 门槛 1
```

合并与清理的完整顺序见 [AGENTS.md](AGENTS.md) 的「关闭与清理顺序」。
