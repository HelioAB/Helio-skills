# flashcard-extract 开发记录

## 定位（2026-10-20 与 formulation 合并讨论定稿）

- 通用制卡 skill，两种输入模式统一重流程（学习目标＋覆盖 → 批量候选 → 审阅修订 → 落盘）：
  - 对话制卡：素材为当前会话上下文，只取耐久知识；
  - 文档制卡：素材为一篇完整 md 文档（知识文档或对话稿）。
- 环境无关：不做 Obsidian 特殊适配，产出便携 Markdown 卡片文件（ADR-0001）。
- 三段流水线：transcript→对话稿 → 素材→卡片（本 skill）→ 卡片→Anki（ADR-0002）；不解析 transcript、不导出 Anki。
- 题目质量与呈现标准整体继承 flashcard-formulation（见 `_source/`），逐字保留；剔除其 Obsidian/vault 耦合（角色契约、Gate、KnowledgeAnchor/P/A ID、插件告警）。

## 已定决策

| 决策点 | 结论 |
|---|---|
| 拆卡粒度 | formulation 立场为准：多维对比、完整解释、整体结构卡合法；“最小信息”为默认倾向而非硬规则 |
| 字段命名 | QA 用 `Front:`/`Back:`/`Extra:`，Cloze 用 `Text:`/`Extra:`；formulation 呈现标准与两张认可样例逐字继承 |
| 工作流 | 两模式统一重流程：推荐 3–5 学习目标＋覆盖 → 首批 5–8 → 反馈校准续批 → 覆盖追踪 → 终审后一次写入 |
| Cloze | 纳入，`{{c1::}}` 语法，判据继承；补一个新制 Cloze 呈现示例（标注待认可） |
| 来源元信息 | 文档制卡附卡级 `Source:` 定位；对话制卡不设（frontmatter topic/date 即出处） |
| Obsidian | 不适配，检测到 vault 时行为与任何环境一致 |
| 对话来源 | 当前会话上下文；对话稿文件按文档制卡处理；不解析 session transcript |
| 落盘 | 终审批准后确认路径写入；对话 `YYYY-MM-DD-<topic-slug>.md`，文档源同目录 `<source-slug>-cards.md`（英文 kebab-case）；目标文件已存在先读入、去重合并、展示差异 |
| frontmatter | `topic`/`date`；文档制卡加 `source`（源文档路径） |
| 卡片语言 | 跟随素材语言，专有名词保留原文 |
| 分隔格式 | 单独一行 `---` 分隔卡片；卡片内容禁止单独成行 `---`；不设卡标题编号（审阅清单编号不入文件） |
| 修订语义 | 批量接受／点名接受或排除／自然语言反馈映射；批准只覆盖已展示对象；不按复习统计自动改卡 |

## 术语与决策记录

- 术语表：`_dev/CONTEXT.md`
- ADR：`_dev/docs/adr/0001-flashcard-extract-environment-agnostic.md`、`_dev/docs/adr/0002-three-stage-flashcard-pipeline.md`

## 待办 / 验证

- [ ] 真实 session 试运行：对话模式与文档模式各至少一次，结论记入 test-log.md
- [ ] 新制 Cloze 呈现示例经真实使用认可或修订
- [ ] 验证有效后移入 skills/，丢弃 `_source/`、`_dev/`，并更新 CHANGELOG.md
