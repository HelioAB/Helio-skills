# GitHub Flow 流程加固：问题、任务与交接

- **状态**：待执行（供新 session 直接执行）
- **日期**：2026-10-21
- **当前分支**：`repo/github-flow`
- **当前 PR**：[#1](https://github.com/HelioAB/Helio-skills/pull/1)（draft，CI 绿，已 self-review，未 merge）
- **范围**：只改流程文本、CI 与测试；不改任何 skill 的行为
- **前置阅读**：`AGENTS.md`、`docs/plan-github-flow.md`、本文件 §0、§1

## 0. 交接摘要（新 session 先读）

### 0.1 已经完成的事

`docs/plan-github-flow.md` 的 §3.1–§3.7 已执行并推送到 `repo/github-flow`：

- `scripts/check.mjs` + `.github/workflows/ci.yml`：门槛 1。
- `skills/session-log/tests/`：夹具、golden、flag/JSON/current 裁剪/export 测试。
- `scripts/link-skill.mjs`：main/worktree/sandbox 链接切换与安全移除。
- `scripts/workitem.mjs`：`plan save`、`uat save`、`sync`、`status`；fake-gh 集成测试。
- `AGENTS.md` 已改为 GitHub Flow + staging/UAT。
- PR #1 已开；CI `check` 通过；self-review 评论已留。

当前验证基线（2026-10-21）：

```text
node scripts/check.mjs                 -> 8 passed, 0 failed
node skills/session-log/tests/run.mjs  -> 18 passed
node scripts/tests/run.mjs             -> 11 passed
node scripts/link-skill.mjs status     -> 两个链接均指向 skills/<name>
```

### 0.2 还没验证的事

- **merge 之后的流程**：draft → ready、rebase merge、merge 后更新本地 main、删除 worktree/分支、sandbox 链接恢复，均未串成一次完整测试。
- **workitem 的真实 gh 调用**：目前只通过 fake-gh 测试；首个真实 skill 工作项才是 dogfood。
- **merge 后 push main 触发的 CI**：未发生。
- **同一 skill 的第二个工作项**：未验证无残留。

### 0.3 不要重复做的事

- 不要重新执行 §3.1–§3.7，也不要重写 `scripts/check.mjs`、`workitem.mjs`、`link-skill.mjs` 的主体逻辑。
- 不要修改 `skills/session-log/scripts/claude-code.mjs` 或 `export.mjs`；已知 `--json` 不一致是独立缺陷，另开工作项。
- 不要在没有移除 worktree 内链接的情况下执行 `git worktree remove`（见 §7 的 junction 警告）。

## 1. 你需要做什么（用户操作区）

### 1.1 推荐路径：新 session 直接执行

1. 在仓库根目录打开新 session。
2. 把下面整段发给它：

```text
读取 docs/plan-github-flow-followups.md，按 §4 执行；§5 采用推荐默认值
（D1=B，D2=保持手动，D3=先加固后合并，D4=保持软检查）。
先跑 §0.1 的基线验证，再按 P0 → P1 顺序改；每改完一项跑对应测试。
完成后推送、等 CI 绿、更新 self-review 评论，然后停在 merge 前，
把 §4.7 的合并/清理命令清单发给我确认。
```

3. AI 停下后，你只需要：
   - 看 `git log --oneline main..HEAD` 和 `git diff --stat main...HEAD`；
   - 看 PR #1 的 CI 与 self-review 评论；
   - 回复“按 §4.7 合并”，或自己执行那几条命令。

如果新 session 开始时 PR #1 已经合并：从最新 `main` 新建 `repo/flow-hardening`
分支，在该分支执行 §4；不要复用已合并的 `repo/github-flow`。

### 1.2 如果你想自己拍板

先回答 §5 的 D1–D4；把选择写进发给 AI 的提示即可。没有特别偏好就用推荐默认值。

### 1.3 如果你现在就想合并 PR #1

**不推荐在加固前合并**，因为 draft → ready 与清理顺序还没有写进 AGENTS。若坚持现在合并，至少执行：

```bash
gh pr ready 1
gh pr merge 1 --rebase
git switch main
git pull --ff-only origin main
git branch -D repo/github-flow
git push origin --delete repo/github-flow   # 若远端未自动删除
```

PR #1 没有 worktree，因此不涉及 worktree 清理；但 skill 工作项必须按 §4.7 的顺序。

### 1.4 验收清单（AI 完成后由你勾）

- [ ] `node scripts/check.mjs` 全绿，且包含新增的 flow 测试。
- [ ] `scripts/tests/run.mjs` 新增的完整流程场景通过，重复运行一致。
- [ ] `.github/workflows/ci.yml` 的 checkout 不再浅克隆；CI 日志不再出现 `cannot diff against base`。
- [ ] `AGENTS.md` 明确写出 draft → ready、merge/清理顺序、main 前进时的同步策略。
- [ ] `CHANGELOG.md` 的 `[Unreleased]` 已记录本轮流程修订。
- [ ] PR #1 CI 绿，self-review 评论已更新。
- [ ] 你确认后才 merge；merge 后本地 main 与 origin/main 同步，分支已删除。

## 2. 当前状态与已覆盖范围

### 2.1 已覆盖（不要重复测）

- `workitem`：plan 创建/更新幂等、UAT 追加+评论、section 去重、`--final`、pending 评论与 pending PR upsert 的 `sync` 重试、status、错误路径、`_dev` 不入库。
- `link-skill`：main/worktree/sandbox 往返、拒绝覆盖真实目录、sandbox cwd 调用。
- 门槛 1 在本地与 PR CI 上均通过。
- 真实 GitHub 上已验证：开 draft PR、CI、self-review 评论。

### 2.2 未覆盖（本轮要补）

- draft PR 未 ready 时不能 merge。
- GitHub rebase merge 后，本地分支的 SHA 与 main 不同；本地 main 需要 `pull --ff-only`。
- merge 后清理顺序：sandbox 链接指回 main → 移除 worktree 内链接 → 移除 worktree → 删本地/远端分支。
- 工作项期间 main 前进时的同步策略。
- 第二个工作项能否从干净状态开始。

## 3. 问题清单（按优先级）

### P0-1 draft PR 不能直接 merge

`plan save` 创建的是 draft PR。`gh pr merge` 会拒绝：“Pull request is still a draft”。AGENTS 与旧计划都没有 `gh pr ready` 这一步。

**修法**：关闭流程加入 `gh pr ready <n>`（或在 merge 命令加 `--ready`）；写进 AGENTS 的流程第 6/7 步。

### P0-2 merge 后的清理顺序未定义

当前 AGENTS 只写“merge → 删除分支/worktree”。实际顺序必须是：

1. 门槛 2 通过、`workitem status` 显示 `pending: 0`、CI 绿、self-review、用户认可。
2. `gh pr ready <n>`。
3. `gh pr merge <n> --rebase`（不要在 worktree 还在时加 `--delete-branch`）。
4. `git fetch origin`。
5. 若用 sandbox：`node scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills`。
6. `node scripts/link-skill.mjs remove <skill> --link-dir <worktree>/.claude/skills`。
7. `git worktree remove <worktree>`。
8. 在 main 检出：`git pull --ff-only origin main`。
9. `git branch -D <skill>/<topic>`（rebase merge 后 SHA 已变，`-d` 会拒绝）。
10. `git push origin --delete <skill>/<topic>`（若未自动删除）。
11. 验证：`git worktree list` 无残留、`git branch -a` 无该分支、`link-skill status` 正确。

**注意**：第 6 步不能省。Windows 上 `git worktree remove` 会沿 junction 删除主检出的 skill（本项目已实际发生过一次）。

### P0-3 “不 force push”与“main 前进后 rebase”冲突

`workitem.mjs` 的安全约束写着“不 force push”；但分支活到 UAT 结束期间 main 可能前进，若要求把分支 rebase 到最新 main，就必须 `--force-with-lease`。两处规则矛盾。

**建议默认（D1=B）**：不 rebase 工作分支；需要同步时在 worktree 内 `git fetch origin` + `git merge origin/main`，再 push。最终 merge 仍用 GitHub 的 rebase merge，main 保持线性。只有你明确允许时才用 `git rebase origin/main` + `git push --force-with-lease`。

### P1-1 CI 的 CHANGELOG 软检查实际失效

已查 CI 日志：

```text
WARN changelog: cannot diff against base — fatal: ambiguous argument
'origin/main...HEAD': unknown revision or path not in the working tree.
```

原因：`actions/checkout@v4` 默认浅克隆，`origin/main` 不存在。修法：checkout 加 `fetch-depth: 0`（仓库很小，成本可忽略）。改完在 CI 日志确认这条 WARN 消失。

### P1-2 `repo/<topic>` 没有 workitem 自动化路径

`workitem` 只接受 `<skill>/<topic>` 和 `.worktree/<skill>/<topic>`。像本 PR 这样的 `repo/github-flow` 只能手动走流程。

**建议（D2）**：明确为有意边界，不扩 `workitem`；repo 级变更继续手动，按 AGENTS 的同一套门槛执行。若以后要自动化，另开工作项。

### P1-3 `plan save` 对陈旧 main 只警告不阻止

本地 main 落后 `origin/main` 时，`plan save` 仍会从旧 main 建分支。警告是否足够需要明确。

**建议**：保持警告，但在 AGENTS 的流程第 1 步加一句“先确认本地 main 与 origin/main 同步”；不把联网 fetch 硬塞进脚本。

### P2 边界（本轮不处理，记录即可）

- `gh pr list --state all` 可能命中已关闭但未合并的 PR；分支名不复用，暂不处理。
- `sync.json` 丢失时可能重复评论；当前接受。
- `plan save` 只创建空提交；若在没有任何内容前就 merge，GitHub 可能拒绝空 PR。实际流程不会这么用。

## 4. 执行任务（给 AI）

### 4.1 修 AGENTS.md 的流程文本

在「已升格 skill 的迭代（GitHub Flow）」的流程中：

- 第 1 步补一句：先确认本地 `main` 与 `origin/main` 同步；不同步时先处理。
- 第 6/7 步之间或第 7 步展开为 §3 P0-2 的 11 步清理顺序。
- 明确：merge 前 `node scripts/workitem.mjs status` 必须显示 `pending: 0`；否则先 `sync`。
- 明确：draft PR 必须先 `gh pr ready <n>`。
- 明确 main 前进时的同步策略（§5 D1 的结果），写清“不 force push”的例外是否存在。
- 保留现有门槛 1/2、记录模型、串行分支等表述，不要退回“轮”模型。

### 4.2 修 CI

`.github/workflows/ci.yml` 的 `actions/checkout@v4` 加：

```yaml
        with:
          fetch-depth: 0
```

其余不变。改完推送，检查 CI 日志里不再出现 `cannot diff against base`。

### 4.3 扩展 fake-gh

在 `scripts/tests/fake-gh.mjs` 增加：

- `pr ready <n>`：把 PR 的 draft 置为 false；记录调用。
- `pr merge <n> --rebase [--delete-branch]`：
  - 若 PR 仍是 draft，按真实 gh 行为退出 1（这样 flow 测试能抓住漏掉 `pr ready`）。
  - 更新 state 中该 PR 为 `MERGED`。
  - 若设置了 `FAKE_GH_REPO` / `FAKE_GH_WORKTREE`，用 git 模拟 rebase merge：
    - `git -C <worktree> rebase main`
    - `git -C <repo> merge --ff-only <branch>`（main 检出在 repo）
    - `git -C <repo> push origin main`
    - 若 `--delete-branch`，删除远端分支并记录。
  - 这只是流程模拟，不代表 GitHub 的真实 rebase 行为。

### 4.4 新增完整流程测试

优先放进 `scripts/tests/run.mjs`（`check.mjs` 已自动发现），复用现有 `withRepo` / `run` / `git` 辅助函数。若拆成 `flow.mjs`，必须同步修改 `check.mjs` 的发现逻辑。

至少两个场景：

**场景 A：happy path**

1. `plan save` 建工作项。
2. 在 worktree 里做一个内容提交（直接写文件即可；门槛 1 用 `node --check` 或跳过完整 check，测试仓库没有完整 scripts）。
3. 用测试仓库内的一份 `link-skill.mjs` 做 worktree 自链（真实脚本从自身 checkout 找仓库，不能直接对临时仓库用；复制脚本到测试仓库的 `scripts/` 再运行）。
4. `uat save --result pass`；重复一次，断言 test-log/评论不重复；`uat save --final --approval yes`。
5. `status` 断言 `pending: 0`。
6. `gh pr ready` → `gh pr merge --rebase`。
7. 清理：移除 worktree 内链接、`git worktree remove`、删本地/远端分支、`pull --ff-only`。
8. 断言：main 含内容提交；无 worktree/branch 残留；`_dev` 不存在；`.claude/skills` 链接指向 main；再 `plan save` 一个新 topic 能正常创建。

**场景 B：工作项期间 main 前进**

1. `plan save` 后，在 main 检出提交一个文件并 push。
2. 在 worktree 内 `git fetch origin` + `git merge origin/main`；push。
3. 运行门槛 1（可只跑 `node --check`）。
4. 按场景 A 完成 ready/merge/清理。
5. 断言 main 同时包含 main 侧与工作项侧的改动，且无冲突/残留。

**可选场景 C**：pending 未清时，流程清单应阻止 merge；可以在测试里断言 `status` 输出 `pending: 1`，并在完成后 `sync`。不要求代码层强制。

### 4.5 更新 CHANGELOG

在 `[Unreleased]` 的 `Changed` 顶部记录本轮流程修订：

- draft → ready 步骤。
- merge/清理顺序与 junction 安全。
- main 前进时的同步策略（D1 结果）。
- CI checkout 改为完整历史，CHANGELOG 软检查恢复生效。
- 新增完整流程模拟测试。

### 4.6 验证、提交、推送

```bash
node scripts/check.mjs
node scripts/tests/run.mjs
node scripts/tests/run.mjs   # 重复运行
node skills/session-log/tests/run.mjs
git diff --check
sh .githooks/pre-commit
git add ...
git commit -m "test(tooling): add full-flow workitem simulation"   # 或按实际内容拆分
git push
gh pr checks 1 --watch
```

提交信息遵循 Conventional Commits，scope 用 `tooling` 或 `repo`。推送后等 CI 绿，更新 PR #1 的 self-review 评论。

### 4.7 合并 PR #1（用户确认后）

PR #1 当前是 `repo/github-flow` 分支，没有 worktree，清理比 skill 工作项简单：

```bash
# 前置：CI 绿、self-review 评论已更新、用户确认
gh pr ready 1
gh pr merge 1 --rebase
git switch main
git pull --ff-only origin main
git branch -D repo/github-flow
git push origin --delete repo/github-flow   # 若远端未自动删除
git worktree list                            # 应只剩主检出与两个草案 worktree
```

merge 后确认 main 上的 CI（push 触发）也通过：

```bash
gh run list --branch main --limit 3
```

若是 skill 工作项（有 worktree/sandbox），不要用上面这段，按 §3 P0-2 的 11 步执行。

## 5. 需要用户决策的点

| # | 问题 | 推荐默认 |
|---|---|---|
| D1 | main 前进后如何同步工作分支：rebase + force-with-lease，还是 merge main into branch？ | **B：merge `origin/main` 进分支，不 force push**；只有你明确允许时才用 force-with-lease |
| D2 | `repo/<topic>` 是否纳入 `workitem` 自动化？ | **保持手动**；workitem 继续只服务 skill 工作项 |
| D3 | 先加固再 merge PR #1，还是先 merge 再开新分支？ | **先加固再 merge**（继续在 `repo/github-flow` 上完成） |
| D4 | CHANGELOG 检查保持软警告，还是 PR 上硬失败？ | **保持软警告**，本轮只修 fetch-depth |
| D5 | pending > 0 时是否要在代码层阻止 merge？ | 不在代码层阻止；写进关闭清单，由 `status` 提示 |

如果新 session 没有收到你的选择，按推荐默认执行，并在报告里注明。

## 6. 模拟测试设计细节

### 6.1 为什么模拟足够

本轮验证的是“流程命令序列与状态收敛”，不是 GitHub 自身实现。临时裸仓库 + clone 可以真实执行 git push、worktree、branch、merge、cleanup；fake-gh 负责 PR 状态。真实 GitHub 语义（draft 限制、rebase merge、Actions）用 PR #1 的一次真实合并验证。

### 6.2 不能由模拟覆盖的事

- GitHub 对 draft、rebase merge、空提交/merge commit 的具体处理。
- PR checks、push-to-main Actions、真实 `gh` 输出与权限。
- Agent 是否按 AGENTS 触发 `plan save` / `uat save`；这只能靠第一个真实 skill 工作项 dogfood。

### 6.3 测试放置

- 首选：在 `scripts/tests/run.mjs` 内追加两个 `test(...)`，复用 `withRepo`、`run`、`git`。
- 若拆文件：`scripts/tests/flow.mjs`，并由 `run.mjs` import 或由 `check.mjs` 发现；不要留下“写了但没人跑”的测试。
- 测试必须是零依赖、临时目录、结束后清理；不得访问真实 GitHub。

## 7. 交接注意

### 7.1 当前仓库状态

- 分支：`repo/github-flow`，跟踪 `origin/repo/github-flow`。
- PR #1：draft，CI 绿，self-review 评论已留。
- 本地 `main` 与 `origin/main` 已同步（`df40683`）。
- 工作区：除本文档外应无未提交修改；若有，先确认是否为本轮遗留。
- `.claude/skills/` 的两个链接当前指向主检出的 `skills/<name>`。
- `.worktree/feat/flashcard-skills`、`.worktree/feat/init-project` 是两个草案 worktree，**不要动**；它们没有 `.claude/skills` 链接。

### 7.2 junction 警告（已实际发生）

验证 `link-skill` 时，`git worktree remove --force` 跟随了 worktree 内的 junction，删除了主检出的 `skills/session-log` 内容（随后从 HEAD 恢复）。因此：

- 删 worktree 前必须先 `node scripts/link-skill.mjs remove ...`。
- 不要对含外部链接的 worktree 直接 `rm -rf` 或 `git worktree remove --force`。
- 如果 `git worktree remove` 因 ignored 文件拒绝，先检查链接，不要习惯性加 `--force`。

### 7.3 权限与 gh

- `.claude/settings.json` 只放行 `node scripts/{workitem,check,link-skill}.mjs`。
- 不要新增 `Bash(gh *)` 的 allow 规则；gh 细节留在脚本里，手动 merge/ready 由用户或授权的命令执行。
- 新增权限规则会触发自我扩权拦截，需要用户明确授权。

### 7.4 不要宣称已验证

在第一个真实 skill 工作项完成 `plan save` / `uat save` / `sync` 之前，不要说“workitem 已真实验证”。fake-gh 测试只证明脚本逻辑与流程序列。

### 7.5 已知但不属于本轮的问题

`session-log` 的 `--json` 不一致：

- `transcript --json` 被忽略，仍输出文本；
- `usage --json` 在 NDJSON 后追加人类可读行与总计；
- `get --json` 是 no-op（本来就输出 JSON）。

这是独立缺陷，另开工作项；不要在本轮顺手改，也不要在测试里固化。

## 8. 命令速查

```bash
# 基线
node scripts/check.mjs
node scripts/tests/run.mjs
node skills/session-log/tests/run.mjs
node scripts/link-skill.mjs status

# 工作项
node scripts/workitem.mjs plan save < plan.md
node scripts/workitem.mjs uat save --venue worktree --session <id> --result pass
node scripts/workitem.mjs uat save --final --approval yes --note "..."
node scripts/workitem.mjs sync
node scripts/workitem.mjs status

# 链接
node scripts/link-skill.mjs status --link-dir <dir>
node scripts/link-skill.mjs <skill> main --link-dir <dir>
node scripts/link-skill.mjs <skill> <worktree> --link-dir <dir>
node scripts/link-skill.mjs remove <skill> --link-dir <dir>

# 合并与清理（skill 工作项；顺序不可换）
gh pr ready <n>
gh pr merge <n> --rebase
git fetch origin
node scripts/link-skill.mjs <skill> main --link-dir <sandbox>/.claude/skills
node scripts/link-skill.mjs remove <skill> --link-dir <worktree>/.claude/skills
git worktree remove <worktree>
git pull --ff-only origin main
git branch -D <skill>/<topic>
git push origin --delete <skill>/<topic>
```
