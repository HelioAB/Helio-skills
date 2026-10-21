# AGENTS.md

本文件是本仓库 agent 指令的唯一事实源（single source of truth）。

## 仓库定位

存放我在真实项目中反复使用、验证过的个人 skills。宁缺毋滥：只有真正用过、确实有效的才留下。

## 目录结构

```text
.
├── skills/
│   └── <skill-name>/       # 一个 skill 一个目录，kebab-case
│       ├── SKILL.md        # 必需：frontmatter + 正文
│       ├── references/     # 可选：按需加载的参考资料
│       ├── scripts/        # 可选：skill 调用的脚本
│       └── _dev/           # 可选：迭代期本地开发目录（gitignored，永不入库）
└── drafts/                 # 开发中的 skill，目录结构同 skills/；验证有效后移入 skills/
    └── <skill-name>/
        ├── _sources/       # 可选：开发期参考（本 skill 派生自哪些 skill）
        └── _dev/           # 可选：开发期计划（plan.md）与测试记录（test-log.md，只记结论与关键片段）
```

## 升格流程（drafts/ → skills/）

前提：`_dev/test-log.md` 里自定的迁移门槛已达成，且经用户认可。

1. test-log 若有未提交修改（通常是最后的门槛验证记录），先单独提交——否则随
   `_dev/` 丢弃后，该记录从未进入过历史。
2. 升格提交 `feat: graduate <name> from drafts/ to skills/`，一次做三件事：
   - `git mv` 运行结构（`SKILL.md`、`references/`、`scripts/`）到 `skills/<name>/`，
     内容不动（保 100% rename）；内容修剪是另一个提交，升格与修改解耦。
   - 整目录丢弃 `_` 前缀目录（`_dev/`、`_sources/`），清掉残留空目录。
   - CHANGELOG `[Unreleased]`：Added 段顶部记升格条目（能力一句话 +
     `Graduated from drafts/<name> after <门槛>`）；test-log 中暂不处置的已知边界以
     "Parked, not applied" 记入——这是它们活过 `_dev/` 丢弃的唯一去处。

## 已升格 skill 的迭代（skills/ 内）

- 就地迭代：直接修改 `skills/<name>/`。`_dev/`（必要时 `_sources/`）是常驻本地的开发工作目录，已被 gitignore——永不入库、永不删除；test-log 按轮分节累积，plan.md 每轮重写。
- 两段门槛（针对行为变更；文档/小修直接提交，不构成迭代）：
  1. 合入前：脚本/夹具验证通过，结论记入 `_dev/test-log.md`；CHANGELOG `[Unreleased]` 条目随内容提交记录。
  2. 关闭前：至少一次真实项目使用，结论记入 test-log，且经用户认可；长期没有真实使用机会时，用户明示豁免并记录。本地 junction 指向 `skills/<name>/`，内容合入 `main` 后日常会话即在使用新版本——真实使用就是测试。
- CHANGELOG 是唯一持久记录（`_dev/` 不入库）：条目须吸收全部结论与 "Parked, not applied" 项。
- 收尾即记：关闭迭代 = 在 test-log 写关闭条目（日期、真实使用轮次、认可或豁免）、plan.md 标记 superseded。没有 close 提交。
- 同一 skill 串行迭代：上一轮未关闭不开新轮；验证窗口期发现缺陷，修复作为同一轮内的又一次内容提交，验证重新起算。

## 分支命名

- `drafts/<name>/` 的初始开发：`feat/<name>`（新增 skill 属仓库级功能）。
- `skills/<name>/` 的升格后迭代：`<name>/<topic>`，kebab-case。一次开发脉冲一条分支：从最新 `main` 创建，内容提交（含脚本验证与 CHANGELOG 条目）后 fast-forward 合入 `main` 并删除分支；已合并的分支名不复用。`_dev/` 不参与版本控制，分支与其解耦——一轮迭代常含多次内容提交、多条分支（验证窗口期的修复各开短分支）。
- 分支名与提交 scope 对齐（`session-log/current-locator` ↔ `feat(session-log): ...`）；skill 迭代分支不加 `feat/`、`fix/` 等类型前缀，因为一轮迭代常混合多种变更类型。topic 取 `_dev/plan.md` 的主题或 CHANGELOG `[Unreleased]` 条目。

## 约定

- `_` 前缀目录均为开发期专用，不属于运行结构；开发期文件一律置于 `_` 目录内，不裸放于 skill 根目录。两侧入库语义不同：`drafts/` 下的入库（升格门槛的证据），移入 `skills/` 时整目录丢弃；`skills/` 下的（迭代期 `_dev/`、`_sources/`）已被 gitignore，本地常驻、永不入库。
- 新增或变更 `skills/` 下的 skill 时，同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段（`drafts/` 不记）。
