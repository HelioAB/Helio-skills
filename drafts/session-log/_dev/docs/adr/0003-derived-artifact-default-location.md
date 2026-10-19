# 派生产物默认落位项目根 session-logs/

T3 用户反馈：导入流程曾把重定向产物指向 temp dir，事后难以定位、无从引用。派生产物可从源 .jsonl 完全再生，故"稳定引用"的要害是位置可预测而非长久保存——定为默认写 `<项目根>/session-logs/<uuid8>-<视图>.md`（项目根 = 消费会话 cwd 的 git 顶层；非 git 仓库则 cwd 本身）。用户在调用时指定目录则仅该会话沿用指定目录（调用方上下文即可，不引入持久化状态）；调用方自知是纯中间产物时仍可用 temp。建议用户将 `session-logs/` 加入 .gitignore。

Considered options（均否）：项目 `docs/sessions/`（可再生数据混入手写文档、易误提交）；配置根或 skill 内部 docs（隐蔽、重装即清空，本仓库已 ignore `.claude/skills/`）；每次未指定先问（快速查询工具扛不起每调一问）；两层 agent/user 分类（T3 翻车正是"当成 agent 消费品"的误判所致）；每项目问一次并记住（个人 skill 不值得为此加状态）；源文件旁 `~/.claude/projects/`（深且隐蔽，与 %TEMP% 同病）。

Consequences: SKILL.md 导入流程第 2 步的 "or a temp dir" 措辞随之改写；test-log T2 段对 ../CONTEXT.md、../docs/adr/ 的引用改为 _dev/ 下新路径。
