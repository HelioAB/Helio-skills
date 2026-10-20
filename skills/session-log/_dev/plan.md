# session-log 迭代 — `current` 定位（2026-10-20）

来源：本 session 的 grill-x 设计访谈（Q1–Q4 全部按推荐项落定）。

## 目标

claude-code backend 新增 locator 令牌 `current`：在 Claude Code session 内调用时，
脚本自动定位当前 session 的 `.jsonl`，用户不再手动传路径。

## 决策

- 形态（Q3a）：脚本层 locator 令牌，`node claude-code.mjs <command> current [options]`；
  解析逻辑全部在脚本内，可独立测试。
- 解析链：`$CLAUDE_CODE_SESSION_ID` →
  `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<munged-cwd>/<id>.jsonl`
  （munged-cwd = cwd 中每个非字母数字字符替换为一个 `-`，不折叠）；
  - env 文件非目录内最新、且最新文件近 10 分钟内被写过 → 告警并改用最新
    （`--continue`/`--resume` 无显式 id 时 env 滞留旧 id 的文档化边角）；
  - 推导路径不存在（异 cwd / 超长截断 / CLAUDE_CONFIG_DIR）→ 在 `projects/*/`
    下按 `<id>.jsonl` 文件名搜索；
  - env 缺失 → 目录内最新 `.jsonl`，输出标注 heuristic；
  - 全失败 → 报错并列候选表（路径 + mtime + 大小）；无持久化场景明确报错。
- 边界：仅 claude-code backend 实现（其他 backend 明确报不支持）；显式路径 >
  `current`；不向 session-store 写任何东西；不加 `latest`；子代理不做特殊处理
  （与父共用同一 jsonl）；不引入 hook/statusline 持久化通道。
- 解析注记（路径 + 途经）走 stderr，stdout 保持纯净（`--json` 不被污染）。

## 配套流程落地（本次一并提交）

- AGENTS.md：新增"已升格 skill 的迭代"约定（Q1a/Q2a/Q4a：原地 `_dev/`、分级验证、
  收尾即弃）。
- SKILL.md：claude-code backend 的 Locator 行加 `current` 与解析链一句话；
  原"自己列目录再与用户确认"保留给非当前 session 的定位。

## 验收门槛（结果记 test-log.md）

1. 真实 session 内 `summary current` 命中正确文件（与 `ls -t` 最新对照）。
2. `env -u CLAUDE_CODE_SESSION_ID` 下走 heuristic 回退且输出标注。
3. 异 cwd 运行触发 `<id>.jsonl` 全局搜索分支。
4. 无 env + 异 cwd → 报错并列候选表（退出码 1）。
5. `--json` 下 stdout 纯净（注记只在 stderr）；显式路径调用回归正常。
