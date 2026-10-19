# session-log 开发测试记录（原名 cc-jsonl）

## T1 真实会话全命令通过（2026-10-18）

对象：`C:\Users\11440\.claude\projects\D--11--Deliverables-D-003--HelioAB-Personally-Use-Skills\0f0f60dd-98d1-4233-957a-2766ea97971c.jsonl`（377.9KB / 80 行；grill-x SKILL.md 精简讨论会话；Claude Code 2.1.296 / glm-5.3）。

结论：7 个命令 + 全部 flag 通过。关键验证点：

- **assistant 合并**：10 条 assistant 行 → 3 条消息（同一 `message.id`、增量 content block，concat 合并）；`--thinking` 下 thinking/text/tool_use block 顺序完整。
- **user 提取**：6 条 user entry 只余 2 条真人 prompt，其余为 tool_result 载体，判断正确。
- **tool 配对**：5 次调用全部配上结果；AskUserQuestion 的 `InputValidationError` 错误文本透出（`<tool_use_error>` 前缀已剥）；1 次 `(no result)` 属实（会话止于提问）。
- **大小口径**：transcript 与 tools 统一为 UTF-8 字节（Read 中文文件 18.7KB 两处一致；首版 tools 用 `.length` 字符数导致 9.2KB/18.7KB 不一致，已修）。
- **grep**：命中 user prompt、attachment（@文件正文）、tool_use input、tool-result 正文，每事件一行，`⟦⟧` 标出匹配段。
- **get 三种 ref**：事件号 `13`、行号 `L42`、uuid 前缀 `4a5ff6b7` 均可取。
- **修过的 bug**：布尔 flag 曾以 `'--json': true` 存储但按 `opts.json` 读取，`--json/--thinking/--sidechain/--no-tools/--full/-i` 全部失效；改为 parseCli 统一产出驼峰字段后通过。同类漏改一处：`cmdTranscript` 内 `opts['--only']` 未随重构改为 `opts.only`，致 `--only` 过滤恒为默认值，已修并验证（`--only attachment` 列出全部 32 条，默认视图仍为 5 条对话事件）。

已知边界：

- attachment 仅 `file` 类型保留正文供 grep（单条上限 500KB）；hook stdout 等其他附件只记类型不搜正文。
- 老版累积式 assistant 行（每行重复全部 block）靠首 block JSON 比对识别，未用真实旧格式样本验证过。
- token 只汇总条目自带的 usage，不做费用换算。

## T2 重构为 session-log dispatcher 架构（2026-10-19）

本轮变更（grill-x docs 会话定案，见 ../CONTEXT.md、../docs/adr/0001、0002）：

- 目录 `cc-jsonl` → `session-log`；脚本 `scripts/cc-jsonl.mjs` → `scripts/claude-code.mjs`（品牌文本同步）。
- SKILL.md 重写为 dispatcher：分配规则（显式点名 > 路径模式 > 文件头 schema > 追问）、统一命令面（7 命令冻结，event idx 唯一通用 get ref）、claude-code 条目（别名 / locator / 存储位置 / 识别特征 / 附加项）、评估流程 + 导入流程（分层取用：重定向到文件，消费端 Read/Grep 按需取）。
- 唯一行为改动：`type:"summary"` 条目升格为 compact-summary 事件——默认进 transcript（`--only` 可排除）、grep 可搜、get 可取；`summary` 新增 `compact` 行（条数 + leaf uuid 前缀）与 JSON 字段 `compactSummaries` / `continuesFrom`。

验证（本机无真实压缩样本——全部 projects 无 `"type":"summary"` 条目）：

- **合成 fixture**（`%TEMP%/session-log-test/fixture.jsonl`，5 行含 summary + leafUuid）：`summary` 出 `compact 1 summary · continues aaaabbbb`；`--json` 出 `continuesFrom`；`transcript` 默认显示 `#0 compact-summary · continues aaaabbbb`（无时间戳显示 `?`，优雅降级）；`grep dispatcher` 命中 summary 文本；`get 0` 返回完整事件 JSON；`--only user` 时 compact 隐藏；`transcript --no-tools > dialogue.md` 重定向出 9 行文件。
- **真实会话**（本 sandbox 项目 live session `8c55fdcb`，832.8KB / 398 行）：summary / user / tools / usage / transcript / grep 全过，attach 直方图正常（hook_success 100 等）。
- **T1 会话回归**（`53772e58`，flashcard 项目）：`--thinking`、`get L42`、uuid 前缀 ref（`8a449cc7` → #19）正常；该文件无 summary 条目，compact 行正确缺席。

已知边界（新增）：

- compact-summary 行文本受 `--max-len` 截断（默认 240），要全文用 `get <idx>`。
- 本机尚无真实 `type:"summary"` 样本，compact 路径仅经合成数据验证；遇到首个真实压缩会话时补记。

## T3 dispatcher 架构回归：53772e58 全量重测（2026-10-19）

对象：`C:\Users\11440\.claude\projects\D--11--Deliverables-D-003--HelioAB-Personally-Use-Skills\53772e58-a886-4d51-8950-78c22575eebe.jsonl`（269.2KB / 86 行；flashcard-extract skill 设计讨论会话；Claude Code 2.1.296 / glm-5.3，branch flashcard-skills）。

结论：7 命令 + flag 全过。关键验证点：

- **assistant 合并**：14 条 assistant 行 → 5 条消息（header 带 `L23-25` 合并行区间）；`--thinking` 下 thinking/text/tool_use block 顺序完整。
- **user 提取**：8 条 user entry → 4 条真人 prompt；#19/#21/#23 疑似重复实为用户三次渐进重发（预览截断下看似相同，transcript 全文可见每次增量），判断正确。
- **tool 配对**：4 次调用全部配上结果；#12 AskUserQuestion 被拒（`<tool_use_error>` 前缀已剥）；`(no result)` 零条。
- **大小口径**：独立从原始 JSONL 测 `Buffer.byteLength` → 421 / 188 / 192B 与 tools 输出逐条一致（UTF-8 字节）。
- **get 三种 ref**：事件号 `19`、行号 `L42`（命中 attachment 行）、uuid 前缀 `8a449cc7`→#19 均可取。
- **grep**：命中 user prompt、assistant 正文、tool_use input、tool-result 正文，`⟦⟧` 标出匹配段；`-i` 生效；attachment-only 文本（"tokens left"、hook_success 正文）正确不命中——本会话 27 条 attachment 无 file 类型，符合已知边界。
- **flag**：`--only user`→4 条、`user,assistant`→9 条；`--sidechain` 本会话无 sidechain 条目，输出不变；`--full`（user 全文）；`--json`（user NDJSON、summary 单对象）；`--max-len 30` 在 transcript 上生效（brief/thinking 截断加 `…`）。
- **无 summary 条目**：compact 行正确缺席，`summary --json` 出 `compactSummaries:0`、`continuesFrom:[]`，与 T2 回归一致。
- **重定向**：`transcript --no-tools > dialogue.md` 出 114 行文件，导入流程可用。

新发现（文档与行为不一致，未修）：

- **`grep --json` 未实现**：flag 被静默忽略，输出与普通模式相同；脚本 USAGE 与 SKILL.md 均把 `--json` 列为通用选项。修法：cmdGrep 按 NDJSON 输出每事件记录，或在两处文档注明 grep 不支持。
- **`--max-len` 作用面易误读**：只作用于 transcript 的 tool brief/thinking/attachment/summary 字符串；`user` 预览固定 100 字符截断、`tools` 固定 100/120，不随 flag 变（USAGE 已写明作用对象，属设计；重测时曾因此误判为 bug）。

用户反馈（仅记录，2026-10-19）：

- **派生产物不应默认落位 %TEMP%**：本轮按 skill 导入流程指引把重定向产物写到了 %TEMP%，用户指出该位置事后难以定位——想引用时无从引用；期望 skill 默认输出到用户能快速找到、可稳定引用的位置。（仅记录意见本身，不附修改建议）
