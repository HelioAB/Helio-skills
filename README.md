# Helio-skills

The skills I personally use in real projects. One skill per directory under `skills/`.

## 目录

- `skills/<name>/` — 已升格、在真实项目中反复使用的 skill。
- `drafts/<name>/` — 开发中的 skill；`_dev/`、`_sources/` 入库作为升格证据，升格时整目录迁入 `skills/`。
- `CHANGELOG.md` — 仓库内唯一持久摘要。

## 开发流程

纯手动 git：分支、提交、PR、合并都由本人直接控制。原有的 workitem / graduation / iteration 自动化流程与两个门槛已于 2026-11-23 移除，自动化流程将重新设计。

在沙盒里试用 skill 时，可用 `node scripts/link-skill.mjs` 把 `.claude/skills/<skill>` 指向 worktree，结束后指回 `main`。
