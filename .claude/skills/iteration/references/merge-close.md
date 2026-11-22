# 合并与清理（「可以合并」）

用户说「可以合并」后，agent 更新 CHANGELOG、在最终树上跑门槛 1、直接跑 `close --yes`，然后报告结果。GitHub 不为 push 或 PR 触发 CI；`main` 由每天的 nightly schedule 审计一次，不等待，不交命令清单。「可以合并」是唯一的合并授权；在此之前 agent 只准备，不 merge。

## 门槛 1（本地检查）

结构/打包、frontmatter、相对链接、脚本语法、夹具回归、仓库不变式；不调用 LLM。UAT 通过后、合并前，在最终树上跑一次 `node scripts/check.mjs`；UAT 后若还有提交，重跑一次。GitHub 不为 push/PR 触发 run，`main` 每天由 `schedule` 审计一次。

## 关闭与清理顺序（不可换）

1. 门槛 2 通过、`node scripts/workitem.mjs status` 显示 `pending: 0`、本地门槛 1 在最终树上通过、用户认可。
2. `gh pr ready <n>`（draft PR 不能直接 merge）。
3. `gh pr merge <n> --rebase`；worktree 还在时不要加 `--delete-branch`。
4. `git fetch origin`。
5. 在主检出：`git pull --ff-only origin main`。
6. 用 sandbox 时：`node scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills`。
7. `node scripts/link-skill.mjs remove <skill> --link-dir <worktree>/.claude/skills`。
8. `git worktree remove <worktree>`。
9. `git branch -D <skill>/<topic>`（rebase merge 后 SHA 已变，`-d` 会拒绝）。
10. `git push origin --delete <skill>/<topic>`（若远端未自动删除）。
11. 验证：`git worktree list` 无残留、`git branch -a` 无该分支、`link-skill status` 目标正确。

第 7 步不能省：Windows 上 `git worktree remove` 会沿 junction 删除主检出的 skill（本项目已实际发生过一次）。

`pull --ff-only` 放在 worktree 移除之前（第 5 步）：pull 失败时 worktree 仍在，`close` 可以重跑，不会卡在“PR 已 merge、worktree 已删、分支还在”的半完成状态。

## 自动化路径

用户说「可以合并」后直接运行
`node scripts/workitem.mjs close [--sandbox <dir>] --yes` —— 预检失败会先停，不会留下半完成状态；`--dry-run` 只在用户要求预览或排查时使用。上面 11 步仍是规范顺序，也是脚本失败时的兜底。`repo/<topic>` 不走 `close`，agent 按同一顺序静默执行并验证，不交命令清单。
