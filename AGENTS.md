# AGENTS.md

## 仓库定位

存放我在真实项目中反复使用、验证过的个人 skills。宁缺毋滥：只有真正用过、确实有效的才留下。

## 目录结构

```text
.
├── skills/<skill-name>/   # 已升格 skill：SKILL.md + 可选 references/、scripts/、tests/（测试夹具，不属于运行结构）
├── drafts/<skill-name>/   # 开发中 skill：_dev/、_sources/ 入库（升格证据），升格时整目录丢弃
├── .claude/
│   ├── settings.json
│   └── skills/            # 本地 junction 链接（gitignored），由 scripts/link-skill.mjs 管理
├── scripts/               # link-skill.mjs：把 .claude/skills/<skill> 指向 worktree 或 main
└── CHANGELOG.md           # 仓库内唯一持久摘要
```

## 开发流程

纯手动 git：分支、提交、PR、合并由用户直接控制。原 workitem / graduation / iteration 自动化流程与两个门槛已于 2026-11-23 整体移除，自动化流程将重新设计；在此之前 agent 只在用户明确要求时执行具体命令，不主动发起流程性动作（不自动同步 main、不自动合并、不自动清理）。
