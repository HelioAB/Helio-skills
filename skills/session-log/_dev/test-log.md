# test-log — `current` locator 迭代（2026-10-20）

环境：Windows 11 · Git Bash · Node v22.18.0 · Claude Code 2.1.296（在本 session 内直接测试，
即真实使用场景）。

## 门槛验证（plan.md 所列 5 项，5/5 通过）

1. **env 主路径**：`summary current` → `current → …\2eacc9c7-….jsonl (via env id)`；
   与 `ls -t` 最新文件一致；summary 报告的 session id 与 `$CLAUDE_CODE_SESSION_ID` 相同。
2. **heuristic 回退**：`env -u CLAUDE_CODE_SESSION_ID … summary current` →
   `(via heuristic: newest in munged cwd, no CLAUDE_CODE_SESSION_ID)`，命中同一文件。
3. **id 搜索分支**：在 `/tmp`（映射 `AppData\Local\Temp`，其 munged 项目目录存在但不含
   本 session 文件）下运行 → `(via id search)`，仍命中本 session 文件。
4. **完全失败**：空临时目录 + 去 env → `error: cannot resolve the current session` +
   根目录范围候选表（前 5：路径/mtime/大小，newest 优先），退出码 1。
5. **stdout 纯净 & 回归**：`--json 2>/dev/null` 输出为纯 JSON（注记仅在 stderr）；
   显式路径调用行为不变。

## 实测发现（Parked, not applied）

- heuristic 分支无新鲜度校验：在 Temp 对应项目目录下命中了 7 天前的旧 session 文件
  （输出已标注 heuristic，按设计不算误报，但"current"语义下有误导可能）。可考虑加
  mtime 阈值或要求确认；暂不做。
- 候选表会并列显示其他并发 live session（另一 sandbox 项目的文件排第一），符合
  "newest 优先"设计；agent 拿到表后应与用户确认而非盲取第一个。

## 结论

门槛 5/5 通过；`current` 定位随本迭代提交，`_dev/` 按迭代约定收尾丢弃。
