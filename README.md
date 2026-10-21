# Helio-skills

The skills I personally use in real projects. One skill per directory under `skills/`.

## 日常开发流程（已升格 skill）

每个**已升格 skill**（`skills/<name>`）的迭代 = 一条分支 = 一个 PR。完整规则见 [AGENTS.md](AGENTS.md)；这里只写用户侧的最短用法。

> `drafts/<name>` 阶段不适用本节：draft 的 `_dev/`、`_sources/` 入库，按 `_dev/test-log.md` 里的自定门槛推进；达到门槛后按 AGENTS.md 的「升格流程」一次性升格。`workitem` 的 `plan`/`uat`/`close` 也只服务 `skills/` 下的工作项。

你不需要记命令，对 agent 说这几句就够了：

| 你说 | 发生什么 |
|---|---|
| 「开始 `<skill>` 的 `<topic>`：`<方案>`」 | 从最新 `main` 建 worktree 和分支，写 plan，开 draft PR |
| 「UAT 通过」/「UAT 有问题：…」 | 把本轮结果写进 `_dev/test-log.md`，并评论到 PR。也可以说「UAT 通过，可以合并」，一次完成验收和授权 |
| 「可以合并」 | agent 更新 CHANGELOG、确认 PR CI 绿、直接跑 `close --yes`：ready → rebase merge → `pull --ff-only` → 清理链接/worktree/分支 → 验证 |

「可以合并」是唯一的合并授权；在你明确说这句话之前，agent 只准备，不 merge。授权后 agent 直接执行，不再先给你看 dry-run，也不交命令清单。

「收尾」「同步 main」不再需要你说：CHANGELOG、pending、CI 检查和 self-review 由 agent 在合并时一并处理；`main` 前进时由 agent 在 UAT 或合并前自行同步。

## 两个门槛

- **门槛 1（CI）**：`node scripts/check.mjs`，也就是 PR 上的 `check`。结构、链接、脚本语法、夹具回归。
- **门槛 2（UAT）**：在声明的场地真实使用，检查输出，由你认可或豁免。

两者都过即进入合并；`pending: 0` 与 self-review 是 agent 的内部步骤，不需要你检查。

门槛 1 在 PR 上运行；合并后的 `main` 每天由 nightly schedule 审计一次，不需要你等待。

## 场地与记录

- 日常在 `.worktree/<skill>/<topic>` 里实现；`skills/<skill>/_dev/` 是 gitignored 的本地工作副本，随 worktree 删除。
- 在独立 sandbox 里试用时，用 `node scripts/link-skill.mjs` 把 `.claude/skills/<skill>` 指向 worktree；结束后指回 `main`。
- 仓库级变更用 `repo/<topic>` 分支，不带 worktree，由 agent 按同一套门槛静默执行、不交命令清单。
- PR 正文 = plan；PR 评论 = 每轮 UAT；`CHANGELOG.md` = 仓库内唯一持久摘要。

## 手动命令（可选）

如果不在 Claude Code 里，或想自己操作：

```bash
node scripts/workitem.mjs plan save < plan.md      # 开始工作项
node scripts/workitem.mjs uat save --venue worktree --session <id> --result pass
node scripts/workitem.mjs status                   # 分支/worktree/PR/pending
node scripts/workitem.mjs sync                     # 重试失败的远端写入
node scripts/workitem.mjs close --dry-run          # 预览将执行的收尾步骤
node scripts/workitem.mjs close --yes              # 执行 ready/merge/清理
node scripts/workitem.mjs close --yes --sandbox <dir>   # UAT 在 sandbox 时顺带切回链接
node scripts/check.mjs                             # 门槛 1
```

`close` 默认就是 dry-run；只有 `--yes` 才改状态。用户说「可以合并」后 agent 直接执行 `--yes`，`--dry-run` 只在用户要求预览或排查时使用。`close` 会按 [AGENTS.md](AGENTS.md) 的顺序执行并验证结果；失败时按脚本输出兜底。
