# type:"summary" 条目升格为 compact-summary 一等事件

重构为 dispatcher 时唯一的行为改动：原本被跳过的 `type:"summary"`（压缩摘要、会话续链）条目升格为 compact-summary 事件——默认进 transcript（`--only` 可排除）、grep 可搜、get 可取；`summary` 新增 compact 行（条数 + leaf uuid 前缀）与 `compactSummaries` / `continuesFrom` 字段。

> 2026-10-20 据 test-log T2 记录重建；原 ADR 未随 5d1329a 入库，已失存。
