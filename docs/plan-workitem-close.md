# workitem close：自动化工作项收尾

- **状态**：待执行（供新 session 直接执行）
- **日期**：2026-10-21
- **当前分支**：`main`（代码基线 `7073a01`；本文件随后单独提交）
- **范围**：改 `scripts/workitem.mjs`、`scripts/tests/fake-gh.mjs`、`scripts/tests/run.mjs`、`README.md`、`AGENTS.md`、`CHANGELOG.md`；不改任何 skill 的行为
- **前置阅读**：`README.md`、`AGENTS.md` 的「关闭与清理顺序」、本文件 §0、§1

## 0. 交接摘要（新 session 先读）

### 0.1 当前状态（2026-10-21）

GitHub Flow 加固与用户文档拆分已完成并合入 `main`：

```text
main                                  7073a01 docs(repo): make README the user-facing workflow guide
node scripts/check.mjs                -> 8 passed, 0 failed
node scripts/tests/run.mjs            -> 14 passed, 0 failed
node skills/session-log/tests/run.mjs -> 18 passed, 0 failed
node scripts/link-skill.mjs status    -> 两个链接均指向 skills/<name>
```

- PR #1 已 rebase 合并（merge commit `6b3931c`）；`repo/github-flow` 本地/远端分支均已删除。
- `README.md` 已是用户手册（五句触发词、两个门槛、场地与记录）；`AGENTS.md` 是 agent 规则，含 11 步「关闭与清理顺序」。
- `.claude/settings.json` 已放行 `Bash(node scripts/workitem.mjs *)`，新增 `close` 子命令**不需要**改权限。
- 工作项 worktree：`.worktree/feat/flashcard-skills`、`.worktree/feat/init-project` 是两个草案 worktree，**不要动**；它们没有 `.claude/skills` 链接。
- 2026-10-21 观察到 GitHub 事件管线滞后：push 后 git ref 立即更新，但 PR head / Actions 可能延迟数分钟到约 20 分钟。等待并重试，不要误判为失败。

### 0.2 本轮目标

让「收尾」不再需要人肉执行 11 步，也不再需要用户在 merge 前复制命令：

```bash
node scripts/workitem.mjs close [--repo <worktree>] [--sandbox <dir>] [--dry-run | --yes]
```

- 默认 `--dry-run`：做预检并打印将执行的步骤，不改任何状态。
- `--yes`：执行 ready → rebase merge → 链接恢复/移除 → worktree 移除 → pull → 删本地/远端分支 → 验证。
- `gh` 仍只在脚本内调用，不新增 `Bash(gh *)` 权限。
- 只服务 `<skill>/<topic>`；`repo/<topic>` 仍保持手动（D2）。

### 0.3 不要重复做的事

- 不要重做 GitHub Flow 加固（AGENTS 11 步、CI `fetch-depth: 0`、fake-gh 的 `pr ready`/`pr merge`、flow A/B 测试）。
- 不要修改 `skills/session-log/scripts/claude-code.mjs` 或 `export.mjs`；`--json` 不一致是独立缺陷。
- 不要扩 `workitem` 去支持 `repo/<topic>`。
- 不要新增 `Bash(gh *)` 允许规则；gh 调用留在脚本里。
- 不要在 worktree 还在时使用 `gh pr merge --delete-branch`。
- 不要用 `git worktree remove --force`，也不要跳过 worktree 内链接的移除（Windows junction 会删到主检出）。

## 1. 你需要做什么（用户操作区）

### 1.1 推荐路径：新 session 直接执行

1. 在仓库根目录打开新 session。
2. 把下面整段发给它：

```text
读取 docs/plan-workitem-close.md，按 §4 执行；§5 采用推荐默认值。
先跑 §0.1 的基线验证，再实现；每完成一项跑对应测试。
完成后推送、等 CI 绿、更新 self-review 评论，然后停在 merge 前，
把合并/清理命令清单发给我确认。
```

3. AI 停下后：
   - 看 `git log --oneline main..HEAD` 和 `git diff --stat main...HEAD`；
   - 看 PR 的 CI 与 self-review 评论；
   - 回复「可以合并」或自己执行 §4.9 的命令。

### 1.2 验收清单

- [ ] `node scripts/workitem.mjs close --help`（或 `--help` 输出）包含 `close` 与 `--dry-run`/`--yes`/`--sandbox`。
- [ ] 默认 `close`（不带 `--yes`）只做 dry-run，不调用 merge、不改 PR/worktree/branch。
- [ ] `close --yes` 在测试仓库中完成 ready → merge → 清理，且结果与现有 flow A 的断言一致。
- [ ] `pending > 0` 时 `close` 明确失败并提示先 `sync`。
- [ ] 已合并的 PR 可以续跑清理（幂等）。
- [ ] `repo/<topic>` 或非工作项分支上运行 `close` 会明确失败。
- [ ] `node scripts/check.mjs` 全绿；`scripts/tests/run.mjs` 连续运行两次结果一致。
- [ ] README 的「可以合并」行与手动命令段已指向 `close`。
- [ ] AGENTS 的「关闭与清理顺序」增加自动化路径说明，11 步仍是规范顺序。
- [ ] CHANGELOG `[Unreleased]` 已记录。
- [ ] PR CI 绿、self-review 已更新；你确认后才 merge。

## 2. 背景与设计

### 2.1 为什么要做

上一轮把 11 步清理写进了 AGENTS，但执行仍靠 agent 逐条跑命令：

- 容易漏步骤（尤其 sandbox 链接与 worktree 内链接）；
- 每步都可能触发一次权限确认；
- 用户仍可能被要求复制命令清单，违背 README 的「说一句话」模型。

`close` 把这些步骤收进一个脚本，默认 dry-run，用户说「可以合并」后 agent 才带 `--yes` 执行。

### 2.2 安全模型

- **默认不执行**：不带 `--yes` 时只预检并打印步骤。
- **预检失败即停**：`pending > 0`、worktree 脏、主检出不在 `main` 或脏、PR 不存在/已关闭，都直接失败。
- **顺序不可换**：完全复刻 AGENTS 的 11 步；先恢复 sandbox 链接，再移除 worktree 内链接，最后移除 worktree。
- **幂等**：PR 已 MERGED 时跳过 ready/merge，继续清理；链接不存在、分支已删除、远端分支已删除都视为成功。
- **CI 不在脚本内强制**：v1 不查询 checks；agent 必须在用户说「可以合并」前确认 `gh pr checks <n>` 全绿。需要代码层强制时另开工作项（D2）。

### 2.3 与文档的关系

- `README.md`：用户视角，写「可以合并」会发生什么。
- `AGENTS.md`：agent 视角，11 步仍是规范；`close` 是它的自动化实现。
- `CHANGELOG.md`：唯一持久摘要。

## 3. 需求清单

### P0-1 `close` 子命令

- CLI：`node scripts/workitem.mjs close [--repo <worktree>] [--sandbox <dir>] [--dry-run | --yes] [--gh <path>]`。
- `--repo` 与 `uat/sync/status` 一致：工作项 worktree（默认当前目录）。
- `--sandbox` 可选；提供时把 `<sandbox>/.claude/skills/<skill>` 指回主检出的 `skills/<skill>`。
- 默认 dry-run；`--yes` 才执行；同时给 `--yes` 和 `--dry-run` 报错。
- 复用 `workContext()`、`loadSync()`、`listPrs()`、`gh()`、`git()`、`mainWorktree()`，不要复制一套 git/gh 逻辑。
- 复用 `scripts/link-skill.mjs` 做链接恢复/移除，不要重新实现 junction 处理。

### P0-2 预检

按顺序检查，失败即 `die()`（退出 1）：

1. `workContext()` 解析出 `<skill>/<topic>` 分支、worktree、skill 目录。
2. `loadSync(devDir).pending.length === 0`；否则提示 `node scripts/workitem.mjs sync`。
3. worktree 干净：`git -C <worktree> status --porcelain` 为空（`_dev/` 与 `.claude/skills/` 已 gitignored，不会误报）。
4. 主检出 `mainWorktree()` 当前分支是 `main`，且 `status --porcelain` 为空。
5. `listPrs(branch)` 找到 PR；`state` 为 `OPEN` 或 `MERGED`；`CLOSED` 直接失败。
6. 若给了 `--sandbox`，目录存在且是目录。
7. dry-run 时打印步骤与 `skip` 原因，退出 0；有阻塞项则退出 1。

### P0-3 执行顺序（`--yes`）

1. 若 PR `OPEN` 且 `isDraft`：`gh pr ready <n>`；已 ready 则跳过。
2. 若 PR `OPEN`：`gh pr merge <n> --rebase`；已 `MERGED` 则跳过。然后重新 `listPrs` 确认 `state === 'MERGED'`。
3. `git -C <main> fetch origin`。
4. 若 `--sandbox`：`node <main>/scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills`。
5. `node <main>/scripts/link-skill.mjs remove <skill> --link-dir <worktree>/.claude/skills`（幂等）。
6. `git -C <main> worktree remove <worktree>`（不要 `--force`）。
7. `git -C <main> pull --ff-only origin main`。
8. `git -C <main> branch -D <branch>`（rebase merge 后 SHA 已变；已删除则跳过）。
9. 若 `git ls-remote --heads origin <branch>` 仍存在：`git -C <main> push origin --delete <branch>`；不存在则跳过。
10. 验证并打印：`git worktree list` 无该 worktree、`git branch --list <branch>` 为空、远端无该分支、`--sandbox` 时链接指向主检出。
11. 打印 PR URL 与「close complete」。

### P1-1 fake-gh 扩展

- `pr list --json ...` 的返回对象增加 `isDraft: p.draft`。
- `pr view --json ...` 同样增加 `isDraft`。
- `workitem.mjs` 的 `listPrs()` 把 `--json` 参数从 `number,url,state` 改为 `number,url,state,isDraft`；真实 `gh` 支持该字段。
- `pr ready`、`pr merge --rebase` 已实现，不需要重写。

### P1-2 测试

在 `scripts/tests/run.mjs` 追加（复用 `withRepo`、`planSave`、`uatSave`、`linkScriptInRepo`、`FAKE_GH`）：

1. **dry-run**：建工作项 + 内容提交后运行 `close --dry-run`；断言输出含步骤、PR 仍 `OPEN`/draft、worktree 与远端分支仍在、状态未变。
2. **pending 阻塞**：制造 pending comment（`FAKE_GH_FAIL=comment` 后 `uat save`），`close --dry-run` 退出非零并提示 `sync`；`sync` 后 `close --dry-run` 通过。
3. **happy path**：`close --yes --sandbox <dir>` 完成全部步骤；断言 PR `MERGED`、main 含内容提交、worktree 消失、本地/远端分支消失、sandbox 链接指向主检出、`_dev` 不存在。
4. **已合并续跑**：先手动 `pr ready` + `pr merge --rebase`，再 `close --yes`；断言跳过 merge 并完成清理。
5. **非工作项分支**：在主检出（`main`）运行 `close`，退出非零并提示 `<skill>/<topic>`。
6. 可选：worktree 有未提交文件时 `close --yes` 拒绝。

现有 flow A/B 是 11 步顺序的回归测试，**不要删除**；新增 close 测试与它们并存。

### P1-3 文档

- `README.md`：
  - 触发表「可以合并」行改为：agent 先 `close --dry-run` 给你看，再 `close --yes` 执行 ready/merge/清理。
  - 手动命令段加入 `close --dry-run` / `close --yes`。
- `AGENTS.md`：
  - 在「关闭与清理顺序」末尾加：自动化路径 `node scripts/workitem.mjs close [--sandbox <dir>]`，默认 dry-run，`--yes` 执行；11 步仍是规范顺序与兜底。
  - 在「工作项自动化」加一条 `close` 的说明。
- `CHANGELOG.md` `[Unreleased]`：Added 记 `close`；Changed 记 README/AGENTS 的自动化收尾路径。

### P2 边界（本轮不处理）

- `close` 内强制检查 CI（可选 `--require-ci`）。
- worktree 已被移除后的续跑模式（只能手动完成剩余清理）。
- `repo/<topic>` 的自动化。
- slash commands（`/workitem-close` 等）。

## 4. 执行任务（给 AI）

### 4.1 先跑基线

```bash
node scripts/check.mjs
node scripts/tests/run.mjs
node skills/session-log/tests/run.mjs
node scripts/link-skill.mjs status
git status --porcelain
```

预期：8/8、14/14、18/18、两个链接正常、工作区干净。

### 4.2 建分支

```bash
git switch main
git pull --ff-only origin main
git switch -c repo/workitem-close
```

`repo/<topic>` 没有 `workitem` 自动化，按 AGENTS 手动走：draft PR = plan，本地门槛 + PR CI，UAT/self-review 后由用户确认再 merge。

### 4.3 实现 `cmdClose`

在 `scripts/workitem.mjs`：

- `USAGE` 增加 `close` 段与选项说明。
- `VALUE_FLAGS` 增加 `sandbox`；`BOOLEAN_FLAGS` 增加 `yes`、`dry-run`。
- `listPrs()` 请求 `isDraft`。
- 在 `cmdUatSave` 与 `cmdSync` 之间加 `cmdClose(flags)`。
- 主分发增加 `cmd === 'close' && sub === undefined`。
- 用 `spawnSync(process.execPath, [path.join(main, 'scripts', 'link-skill.mjs'), ...])` 调用链接脚本；失败时把 stderr 带进错误信息。
- 所有 git/gh 调用复用现有 helper；幂等步骤用 `{ allowFail: true }` 并显式验证结果。

### 4.4 编写测试

在 `scripts/tests/run.mjs` 增加 §3 P1-2 的场景。建议新增辅助函数：

```js
function closeWorkItem({ repo, worktree, env, sandboxDir, args = [] }) {
  return ok(
    [WORKITEM, 'close', '--yes', '--sandbox', sandboxDir, ...args, '--gh', FAKE_GH],
    {
      cwd: worktree,
      env: { ...env, FAKE_GH_REPO: repo, FAKE_GH_WORKTREE: worktree },
    }
  );
}
```

dry-run 场景不要带 `--yes`，并断言 `readGh(ghState).prs[0].state === 'OPEN'`、`draft === true`。

### 4.5 更新文档

按 §3 P1-3 修改 README、AGENTS、CHANGELOG。保持 README 的用户视角，不要把 11 步命令复制进 README；指向 AGENTS。

### 4.6 验证、提交、推送

```bash
node scripts/check.mjs
node scripts/tests/run.mjs
node scripts/tests/run.mjs   # 重复运行
node skills/session-log/tests/run.mjs
git diff --check
sh .githooks/pre-commit
```

建议拆分提交（Conventional Commits，scope 用 `tooling` / `repo`）：

1. `feat(tooling): add workitem close with dry-run preflight`
2. `test(tooling): cover close dry-run, blockers, and cleanup`
3. `docs(repo): document the automated close path`（README/AGENTS/CHANGELOG）

推送后：

```bash
gh pr checks <n> --watch
```

等 CI 绿，更新 PR 的 self-review 评论（GitHub 不允许自我 approve，评论即记录）。

### 4.7 合并与清理（用户确认后）

这是 `repo/workitem-close` 分支，无 worktree：

```bash
gh pr ready <n>
gh pr merge <n> --rebase
git switch main
git pull --ff-only origin main
git branch -D repo/workitem-close
git push origin --delete repo/workitem-close   # 若远端未自动删除
git worktree list
```

merge 后确认 main 的 push CI：

```bash
gh run list --branch main --limit 3
```

若 GitHub 事件管线仍滞后，等待后重试；不要因暂时没有 run 就重复 push。

## 5. 需要用户决策的点（推荐默认）

| # | 问题 | 推荐默认 |
|---|---|---|
| D1 | `close` 默认行为 | **默认 dry-run**；只有 `--yes` 执行。同时给两者报错。 |
| D2 | 是否在 `close` 内强制检查 CI | **v1 不查**；agent 在用户说「可以合并」前运行 `gh pr checks` 确认。需要代码层强制时另开工作项。 |
| D3 | sandbox 链接 | `--sandbox <dir>` 可选；不猜路径。未提供时不碰任何 sandbox 链接。 |
| D4 | `repo/<topic>` | `close` 拒绝；仓库级变更继续手动。 |
| D5 | worktree 有未提交改动 | 拒绝执行，提示先提交/清理。 |
| D6 | PR 已 MERGED | 跳过 ready/merge，继续清理（幂等续跑）。 |
| D7 | 分支删除 | 脚本删除本地与远端分支；merge 时不加 `--delete-branch`。 |

若新 session 没收到选择，按推荐默认执行，并在报告里注明。

## 6. 测试设计细节

### 6.1 为什么 fake-gh 足够

`close` 验证的是命令顺序与状态收敛：gh 侧只需伪造 PR 状态（draft/OPEN/MERGED），git 侧由临时裸仓库 + clone 真实执行 worktree、push、merge、branch。真实 GitHub 的 rebase merge 与权限仍靠下一次真实 skill 工作项 dogfood（§7.4）。

### 6.2 测试必须零依赖、临时目录、结束后清理

沿用 `withRepo()`：临时裸仓库 + clone + fake-gh state 文件。不得访问真实 GitHub。

### 6.3 覆盖矩阵

| 场景 | 断言 |
|---|---|
| dry-run | 输出步骤；PR 仍 OPEN/draft；worktree/branch 仍在 |
| pending > 0 | 退出非零；提示 sync；未 merge |
| happy path | PR MERGED；main 含内容；worktree/分支/`_dev` 消失；sandbox 链接指向 main |
| 已合并续跑 | 跳过 merge；清理完成 |
| 非工作项分支 | 退出非零；提示 `<skill>/<topic>` |
| 脏 worktree（可选） | 退出非零；未 merge |

## 7. 交接注意

### 7.1 当前仓库状态

- `main` = `7073a01`；PR #1 已合并；`repo/github-flow` 已删除。
- 两个草案 worktree：`.worktree/feat/flashcard-skills`、`.worktree/feat/init-project`；**不要动**。
- `.claude/skills/` 两个链接指向主检出。
- `.claude/settings.json` 已放行 `node scripts/workitem.mjs *`，无需新增权限。
- GitHub 事件管线在 2026-10-21 有滞后；推送后耐心等待，必要时重试 `gh pr view`/`gh run list`。

### 7.2 junction 警告（已实际发生）

- 删 worktree 前必须先移除其中的链接；`close` 的第 5 步不能省。
- 不要对含链接的 worktree 直接 `rm -rf` 或 `git worktree remove --force`。
- 若 `git worktree remove` 因 ignored 文件拒绝，先检查链接，不要习惯性加 `--force`。

### 7.3 权限与 gh

- 只允许 `node scripts/{workitem,check,link-skill}.mjs`；不要新增 `Bash(gh *)`。
- `close` 的 `gh pr ready` / `gh pr merge` / `gh pr list` 都在脚本内调用。
- 手动 merge/ready 由用户或明确授权的命令执行。

### 7.4 不要宣称已验证

- fake-gh 测试只证明脚本逻辑与流程序列。
- 真实 `gh pr ready` / `gh pr merge` 只有在下一次真实 skill 工作项 dogfood 后才能说「已验证」。
- 若本轮用真实仓库的临时工作项验证过，请在报告里写明是如何验证的。

### 7.5 已知但不属于本轮的问题

- `session-log --json` 不一致（`transcript` 忽略、`usage` 追加人类可读行、`get` 是 no-op）。
- `gh pr list --state all` 可能命中已关闭未合并的 PR；分支名不复用。
- `sync.json` 丢失可能重复评论。
- `plan save` 只创建空提交；无内容就 merge 可能被 GitHub 拒绝。

## 8. 命令速查

```bash
# 基线
node scripts/check.mjs
node scripts/tests/run.mjs
node skills/session-log/tests/run.mjs
node scripts/link-skill.mjs status

# close
node scripts/workitem.mjs close --dry-run
node scripts/workitem.mjs close --yes
node scripts/workitem.mjs close --yes --sandbox <sandbox>

# 工作项记录
node scripts/workitem.mjs uat save --venue worktree --session <id> --result pass
node scripts/workitem.mjs uat save --final --approval yes --note "..."
node scripts/workitem.mjs status
node scripts/workitem.mjs sync

# repo 分支合并（用户确认后；无 worktree）
gh pr ready <n>
gh pr merge <n> --rebase
git switch main
git pull --ff-only origin main
git branch -D repo/workitem-close
git push origin --delete repo/workitem-close
git worktree list
gh run list --branch main --limit 3
```
