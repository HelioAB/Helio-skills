# cc-jsonl 重构为 session-log dispatcher 架构

原 cc-jsonl 是针对 Claude Code jsonl 的单体脚本；为支持多个 coding agent，重构为 dispatcher：SKILL.md 只做分配（显式点名 > 路径模式 > 文件头 schema > 追问），每个 agent 一个 backend 脚本加一个 Backends 条目，新增 agent 不再触碰其他部分。统一命令面七命令冻结，event idx 是唯一保证通用的 get 引用。

> 2026-10-20 据 test-log T2 记录重建；原 ADR 未随 5d1329a 入库，已失存。
