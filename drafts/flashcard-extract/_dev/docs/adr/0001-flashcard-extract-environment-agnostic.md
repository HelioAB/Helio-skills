# flashcard-extract 走环境无关路线，不绑定 Obsidian

旧 skill flashcard-formulation 与 Obsidian vault 深度耦合：权限与角色契约挂在 vault 的 AGENTS.md/SYSTEM_DESIGN.md 上，交付受逐 Note 导出边界与 Anki 插件解析核对约束。决定：flashcard-extract 不继承这些环境耦合，定位为任何环境可用的通用制卡 skill，输入限定两类——多轮 AI 对话（conversation mode）与既有完整 md 知识文档（document mode）；formulation 中精心调整的题目质量与 QA 呈现标准全部吸收。Obsidian 不做任何特殊适配（2026-10-20 已决）：检测到 vault 时行为与任何环境完全一致，导入与格式转换归流水线下游。
