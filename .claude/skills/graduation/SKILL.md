---
name: graduation
description: drafts/<name> 开发中 skill 的推进与升格流程：draft 阶段按 _dev/test-log.md 自定门槛推进（_dev/、_sources/ 入库，不套用 GitHub Flow），门槛达成并经用户认可后在 feat/<name> 分支做升格提交、一次性迁入 skills/。当用户讨论 drafts/ 下 skill 的测试推进、门槛达成或要求升格到 skills/ 时使用；升格后的迭代见 iteration skill。
---

# draft 阶段推进与升格（drafts/ → skills/）

draft 开发阶段**不套用** iteration 的 GitHub Flow：`drafts/` 的 `_dev/`、`_sources/` 入库，按 `_dev/test-log.md` 的自定门槛推进；只有升格提交及升格后的迭代进入 `<skill>/<topic>` 工作项 + 门槛 1/UAT（见 [../iteration/SKILL.md](../iteration/SKILL.md)）。`workitem` 的 `plan save`/`uat save`/`close` 只接受 `skills/<skill>`。

| 子流程 | 时机 | 详见 |
|---|---|---|
| draft 阶段推进 | 每轮测试/推进 `drafts/<name>` | [draft-stage](references/draft-stage.md) |
| 升格 | 自定迁移门槛达成 + 用户认可 | [graduate](references/graduate.md) |
