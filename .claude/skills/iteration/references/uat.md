# UAT（门槛 2）

门槛 2（UAT）：声明的 UAT 场地真实使用 + 输出检查 + 用户认可/豁免。

流程：建链接后真实使用；每轮结束运行 `node scripts/workitem.mjs uat save`（`_dev/test-log.md` + PR 评论），每轮最多一条评论；`--final` 不再是必需产物。sandbox 场地执行 `uat save` 时用 `--repo <worktree>` 指向工作项 worktree。

缺陷同分支修复，重跑门槛 1，行为有变时重新验收；新需求开新工作项。

## 链接命令

- worktree 自链：`node scripts/link-skill.mjs <skill> <worktree> --link-dir <worktree>/.claude/skills`
- sandbox 试用：同一命令改 `--link-dir <sandbox>/.claude/skills`
- 合入后指回主检出：`node scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills`
- 删除 worktree 前先移除其中的 skill 链接
  （`node scripts/link-skill.mjs remove <skill> --link-dir <worktree>/.claude/skills`）：
  Windows 上递归删除会沿 junction 删到主检出。
