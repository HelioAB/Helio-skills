# Skills 仓库领域语言

个人验证型 skills 仓库的术语表。当前条目围绕 flashcard-extract 的开发讨论。

## Language

### 制卡（Flashcard）

**flashcard-formulation**:
前代个人制卡 skill，面向 Obsidian vault 场景；其题目质量与 QA 呈现标准是 flashcard-extract 的继承来源。
_Avoid_: 旧制卡 skill

**flashcard-extract**:
开发中的通用制卡 skill，从多轮 AI 对话或既有 md 知识文档中提取知识制成闪卡，不绑定任何笔记环境。
_Avoid_: 新 formulation

**对话制卡（conversation mode）**:
flashcard-extract 的一种输入模式，素材是一场刚进行完的 AI 多轮对话。

**文档制卡（document mode）**:
flashcard-extract 的一种输入模式，素材是一篇已存在的完整 md 文档（知识文档或对话稿）。

**对话稿**:
session transcript 经上游 skill 过滤得到的可读对话记录 md；可作为文档制卡的素材。
_Avoid_: transcript、聊天记录

**耐久知识**:
对话或文档中值得长期回忆的概念、机制、区别、因果与数字/事实；不含调试过程、任务协调等过程性内容。
_Avoid_: 知识点、干货

**学习目标＋覆盖**:
一次制卡任务所服务的学习用途，连同纳入与略过的内容范围；由推荐或用户自由输入确定，两种输入模式通用。
_Avoid_: 主题
