# 开始工作项（plan）

用户说「开始 `<skill>` 的 `<topic>`：`<方案>`」后：先讨论方案；用户说「保存为 plan」（或「更新 plan/记录方案」）→ `node scripts/workitem.mjs plan save`（从最新 `main` 建 `<skill>/<topic>` 分支和 `.worktree/<skill>/<topic>` worktree、写 `_dev/plan.md`、空提交 + push、开 draft PR）。draft PR 正文 = plan。

开工前先 `git fetch origin` 确认本地 `main` 与 `origin/main` 同步；落后就先处理，不要从陈旧 `main` 建分支。

## 分支与提交

- `main` 始终可用；一个工作项 = 一条分支 = 一个 PR。
- 分支命名：`<skill>/<topic>`（kebab-case，不加 `feat/`/`fix/` 前缀）；repo 级流程变更用 `repo/<topic>`；升格沿用 `feat/<name>`。
- 从最新 `main` 创建；merge 用 rebase；merge 后删除分支与 worktree；已合并分支名不复用。
- 提交信息用 Conventional Commits，scope 与 skill 名一致
  （`session-log/current-locator` ↔ `feat(session-log): ...`）；topic 取 `_dev/plan.md`
  的主题或 CHANGELOG `[Unreleased]` 条目。
- 文档/小修可直接提交 `main`。
- `skills/` 下新增或变更，必须在同次内容提交中同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段（`drafts/` 不记）。

实现阶段：同分支提交（缺陷处理与验收循环见 [uat.md](uat.md)）。
