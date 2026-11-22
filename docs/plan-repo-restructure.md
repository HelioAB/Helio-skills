# 仓库重组计划：工作流 skill 化 / benchmark / CHANGELOG 瘦身

- 状态：**已达成共识，未执行**（2026-11-22 grill-x 访谈定稿，Q1–Q16 全部 settle）
- 执行顺序：**A（AGENTS.md 重组）→ C（benchmark 试点+铺开）→ B（CHANGELOG 改写）**
- 每个提案各走一条 `repo/<topic>` 分支，由 agent 按 AGENTS.md 静默执行、不交命令清单

## 提案 A — AGENTS.md 渐进式披露重组

1. 工作流内容变成入库的 skill，放 `.claude/skills/` 下。git 可见性用
   `.claude/skills/*` + 逐 skill `!` 例外实现，**不整行删 ignore**——本地 junction
   链接保持不入库，防止 `git add` 沿链接把主检出内容收进索引。
2. 拆两个 skill：`graduation`（draft 阶段推进 + 升格提交）、`iteration`
   （迭代全流程：plan / UAT / 合并 / close 清理 / main 同步 / workitem 命令 /
   分支规范）。
3. skill 内部同样渐进式披露：SKILL.md 只留触发词映射 + 各子流程一句话 + 指针表；
   子过程各一个 `references/<topic>.md`——`iteration` 拆 plan / uat /
   merge-close（含 11 步顺序与 close 兜底）/ sync / workitem-commands，
   `graduation` 拆 draft-stage / graduate，实现时按单一主题微调。
4. AGENTS.md 最终形态：仓库定位 + 目录结构树 + 流程索引表
   （流程名 / 触发词 / skill 路径），约 30–40 行；触发词同时写进各 SKILL.md
   description 供 Claude Code 自动发现，索引表让其他 agent 一跳可读。
5. 纯搬家：流程语义零改动；重组后若仍觉重，砍步骤另开工作项。
6. CLAUDE.md 保持一行 `@AGENTS.md` 指针；check.mjs 的结构检查
   （frontmatter、相对链接）扩展覆盖入库的工作流 skill，仍不调 LLM。

## 提案 B — CHANGELOG 瘦身

7. 条目全部一行式：`- YYYY-MM-DD type(scope): 一句话 (#PR号)`；删
   Keep-a-Changelog/SemVer 抬头；保留 `[Unreleased]` 段名；check.mjs 软检查不动。
8. 存量现在一次性全改写，旧详情留在 git 历史；该一行式义务同样覆盖
   `.claude/skills/` 工作流 skill 的变更。
9. 不用 GitHub Issues；现存 6 条 parked 记录在改写时迁入 benchmark 成为
   case 残根/积压（见提案 C 第 15 条）。

## 提案 C — benchmark

10. `benchmark/<skill>/<case-id>/` 全入库：`task.md`（测试题）、`output/`
    （产出或效果）、`trajectory.md`、`evaluation.md`；case-id 用 kebab-case。
11. 本意是自动化测试：`benchmark/run.mjs` 全自动 runner——建 sandbox、链 skill
    （与 UAT 同机制）、逐 case 用 headless `claude -p` 驱动（多轮交互用预置
    用户回应脚本扮演）、经 session-log 自动导出 trajectory、按 rubric 预填
    评价草稿；用户只观察结果、给建议。runner 加入 `.claude/settings.json`
    allowlist。
12. trajectory = session-log 导出的 `transcript` + `tools` 两视图
    （工具调用过程由 `tools` 视图覆盖），需要时加 `usage`。
13. 评价：每 skill 一张固定评分维度表（rubric），agent 打分、用户确认；
    `evaluation.md` = 评分表 + 与上一版对比。快照覆盖式更新，
    上一版在 git 历史里 diff。
14. 铺开：先试点 flashcard-extract（最「生成式」、最缺确定性覆盖），跑通后铺
    grill-x、session-log。试点第一件要验证的事：headless + 回应脚本的
    多轮保真度（flashcard 批间修订环节），失真则该环节降级半自动。
15. 升格门槛新增：升格前测试题 + 基线运行必须就位；draft 阶段的 parked 留在
    入库的 `_dev/test-log.md`，升格时随基线一起迁入 benchmark 积压。
16. `skills/<skill>/tests/`（确定性夹具、门槛 1）与 benchmark（定性、需 LLM）
    并存；check.mjs 不为 benchmark 加检查。

## 执行

17. 三个提案各走一条 `repo/<topic>` 分支；顺序 A → C → B——B 最后，因为存量
    parked 要等 benchmark 结构就位才能迁入。
18. 每条分支内同步修订受影响的 AGENTS.md / README / check.mjs 段落。

---

本文档仅记录共识，不含执行产物；三项全部落地后可按仓库惯例移除
（同 `plan-workflow-simplify.md` 的处置）。
