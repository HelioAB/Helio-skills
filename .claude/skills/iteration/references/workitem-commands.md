# workitem 命令

- `node scripts/workitem.mjs plan save`：写 `_dev/plan.md`，建/更新 draft PR 正文；工作项不存在时自动创建分支/worktree。plan 正文从 stdin（推荐 heredoc）读取；为空时沿用已有的 `_dev/plan.md`。
- `node scripts/workitem.mjs uat save ...`：追加 `_dev/test-log.md`，发 PR 评论；每轮 UAT 后自动运行。
- `node scripts/workitem.mjs uat save --final ...`：可选的最终认可/豁免记录；不再是关闭前的必需产物。
- `node scripts/workitem.mjs close [--sandbox <dir>] [--dry-run | --yes]`：预检
  `pending: 0`、worktree 干净、主检出在 `main`、PR `OPEN`/`MERGED`；授权后直接
  `--yes`，预检失败会先停。执行 ready → rebase merge → `fetch` + `pull --ff-only` →
  sandbox 链接恢复 → worktree 内链接移除 → worktree 移除 → 本地/远端分支删除 →
  验证。主检出的无关改动不阻塞 close；`pull` 在清理前执行，失败时 worktree 仍在，
  可重跑。默认 dry-run；已 `MERGED` 的 PR 跳过 ready/merge，可续跑。
- `node scripts/workitem.mjs sync`：重试失败的远端同步。
- `node scripts/workitem.mjs status`：分支/worktree/PR/pending 状态。

触发词与语义：面向用户的触发词与最短用法见 `README.md`。用户说“保存为 plan/更新 plan/记录方案”时运行 `plan save`（本地优先，gh 失败留 pending）。agent 必须把「开始 `<skill>` 的 `<topic>`」「UAT 通过/有问题」「可以合并」映射到对应动作；「收尾」「同步 main」不再是用户触发词，由 agent 内部处理。用户说「可以合并」后自行执行 [merge-close.md](merge-close.md) 的关闭与清理顺序，不再要求用户复制命令或确认 dry-run。

`workitem` 只服务 `<skill>/<topic>` 工作项；`repo/<topic>` 这类仓库级变更保持手动，按同一套门槛（plan/本地门槛 1/UAT/self-review）由 agent 静默执行、不交命令清单，不扩 `workitem`。

权限只放行 `node scripts/{workitem,check,link-skill}.mjs`；不要直接允许 `gh`。
