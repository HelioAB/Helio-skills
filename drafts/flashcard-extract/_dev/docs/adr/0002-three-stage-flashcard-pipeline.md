# 制卡三段流水线；flashcard-extract 只承担中段

session transcript 直接导入主会话会挤占上下文并加速 compaction，故制卡拆为三段流水线、各由独立 skill 承担：transcript→对话稿、素材（当前会话或 md 文档）→卡片（flashcard-extract）、卡片→Anki。因此 flashcard-extract 拒绝解析 session transcript、拒绝导出 Anki，输入只限当前会话上下文与现成 md 文档（含对话稿）。
