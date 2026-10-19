# session-log

session-log skill 的领域词汇表：解析任意 coding agent 的会话日志，供评估与选择性续用。
2026-10-20 依 test-log T2 记录重建（原文件未随 5d1329a 入库，已失存）；「派生产物」为本次会话新增。

## 架构

**Dispatcher**:
SKILL.md 本体的角色——不含解析逻辑，只判定目标 agent 并驱动其 backend。
_Avoid_: 路由器、入口脚本

**Backend**:
一个 coding agent 的解析后端（`scripts/` 下一个脚本 + 一个 Backends 条目），对统一命令面给出该 agent 的实现。
_Avoid_: parser、driver

**命令面（command surface）**:
七个命令的冻结集合（summary / transcript / user / tools / usage / get / grep），所有 backend 同构实现；agent 未记录的数据打印 not recorded 而非命令缺席。
_Avoid_: API、CLI 列表

**Event idx**:
事件在一份会话日志内的稳定序号（`#n`）；唯一保证在所有 backend 都可作 get 引用的形式。
_Avoid_: 行号（仅个别 backend 的 get 额外接受）、uuid 前缀

**Locator**:
定位一份会话日志的输入；claude-code 下即一个 session 文件路径。
_Avoid_: session id（那是日志内部字段，不是输入）

**Alias**:
用户点名某 agent 时接受的名字（如 claude code、cc）；只在 dispatch 的第一优先级起作用。
_Avoid_: backend 名

## 会话数据

**Compact-summary**:
压缩摘要升格而成的一等事件：默认进 transcript（`--only` 可排除）、grep 可搜、get 可取；summary 报告其 leaf uuid 链。
_Avoid_: summary 条目（那是原始 jsonl 里的 `type` 值）

**派生产物（derived artifact）**:
从源会话日志解析并重定向出的文件（如 dialogue.md）；可随时从源 .jsonl 再生，源日志才是完整记录。
_Avoid_: 输出文件、导出文件、dump
