# AGENTS.md

本文件是本仓库 agent 指令的唯一事实源（single source of truth）。

## 仓库定位

存放我在真实项目中反复使用、验证过的个人 skills。宁缺毋滥：只有真正用过、确实有效的才留下。

## 目录结构

```text
skills/
  <skill-name>/       # 一个 skill 一个目录，kebab-case
    SKILL.md          # 必需：frontmatter + 正文
    references/       # 可选：按需加载的参考资料
    scripts/          # 可选：skill 调用的脚本
```

## 约定

- 新增或变更 skill 时，同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段。
