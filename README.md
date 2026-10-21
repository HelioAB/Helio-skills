# Helio-skills

The skills I personally use in real projects. One skill per directory under `skills/`.

## 日常开发流程（已升格 skill）

每个**已升格 skill**（`skills/<name>`）的迭代 = 一条分支 = 一个 PR。完整规则见 [AGENTS.md](AGENTS.md)；这里只写用户侧的最短用法。

> `drafts/<name>` 阶段不适用本节：draft 的 `_dev/`、`_sources/` 入库，按 `_dev/test-log.md` 里的自定门槛推进；达到门槛后按 AGENTS.md 的「升格流程」一次性升格。`workitem` 的 `plan`/`uat`/`close` 也只服务 `skills/` 下的工作项。

你不需要记命令，对 agent 说这几句就够了：

| 你说 | 发生什么 |
|---|---|
| 「开始 `<skill>` 的 `<topic>`：`<方案>`」 | 从最新 `main` 建 worktree 和分支，写 plan，开 draft PR |
| 「UAT 通过」/「UAT 有问题：…」 | 把本轮结果写进 `_dev/test-log.md`，并评论到 PR |
| 「同步 main」 | 在 worktree 里 `fetch` + `merge origin/main`（不 force push） |
| 「收尾」 | 更新 CHANGELOG、记录最终认可、确认 `pending: 0`、跑门槛 1、等 CI、self-review |
| 「可以合并」 | agent 先跑 `workitem close --dry-run` 给你看步骤，再跑 `close --yes` 执行 ready → rebase merge → 清理链接/worktree/分支 |

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
node scripts/workitem.mjs close --dry-run          # 预检并打印将执行的收尾步骤
node scripts/workitem.mjs close --yes              # 执行 ready/merge/清理
node scripts/workitem.mjs close --yes --sandbox <dir>   # UAT 在 sandbox 时顺带切回链接
node scripts/check.mjs                             # 门槛 1
```

`close` 默认就是 dry-run；只有 `--yes` 才改状态。合并后它会按 AGENTS 的 11 步顺序执行并验证结果。完整顺序与失败兜底见 [AGENTS.md](AGENTS.md) 的「关闭与清理顺序」。
