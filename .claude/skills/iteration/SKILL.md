---
name: iteration
description: 已升格 skill（skills/<name>）的工作项迭代全流程：开始工作项（「开始 <skill> 的 <topic>」「保存为 plan」）、UAT 记录（「UAT 通过」「UAT 有问题：…」）、合并与清理（「可以合并」，唯一合并授权）、main 前进同步与 workitem 命令。当用户要迭代 skills/ 下的 skill、反馈 UAT 结果或授权合并时使用；drafts/ 阶段见 graduation skill。
---

# 已升格 skill 的迭代（GitHub Flow）

- 一个工作项 = 一条分支 = 一个 PR = 一次行为变更。
- `skills/<skill>/_dev/` 是当前 worktree 内的 per-branch 工作副本（gitignored，随 worktree 删除），不是记录。
- 持久记录：PR 正文（plan）、PR 评论（UAT）、`CHANGELOG.md`（仓库内唯一持久摘要）；PR 正文/评论是远程持久记录。最终认可不另发评论（用户授权 + PR `MERGED` 即记录）；self-review 在 agent 内部完成，有发现才写 PR 评论。
- 同一 skill 同时只开一条分支；不同 skill 可并行。

| 子流程 | 触发词 / 时机 | 详见 |
|---|---|---|
| 开始工作项 | 「开始 `<skill>` 的 `<topic>`」「保存为 plan/更新 plan/记录方案」 | [plan](references/plan.md) |
| UAT（门槛 2） | 「UAT 通过」「UAT 有问题：…」 | [uat](references/uat.md) |
| 合并与清理 | 「可以合并」（唯一合并授权） | [merge-close](references/merge-close.md) |
| main 同步 | agent 在 UAT/合并前自动，非用户触发词 | [sync](references/sync.md) |
| workitem 命令 | 上述动作的命令语义与权限 | [workitem-commands](references/workitem-commands.md) |
