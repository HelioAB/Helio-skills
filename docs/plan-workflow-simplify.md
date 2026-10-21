# 开发流程精简（workflow simplification）

- **状态**：P0 已完成（PR #3，rebase merge `461616c`，2026-10-21）；P1–P2 待决策；P3 的 main CI 已决（nightly schedule）
- **日期**：2026-10-21
- **基线**：`main` @ `9cdb6f6`（PR #2 已 rebase merge；`repo/workitem-close` 本地/远端均已删除）
- **范围**：P0 改 `README.md`、`AGENTS.md`、`scripts/workitem.mjs`、`scripts/tests/run.mjs`、`CHANGELOG.md`；P1/P2 各开独立工作项；P3 只讨论
- **前置阅读**：`README.md`、`AGENTS.md`、`scripts/workitem.mjs` 的 `cmdClose`、`docs/plan-workitem-close.md`（上一轮，仅作背景）

## 0. 交接摘要（新 session 先读）

### 0.1 当前状态（2026-10-21）

```text
main                                  9cdb6f6 docs(repo): document the automated close path
node scripts/check.mjs                -> 8 passed, 0 failed
node scripts/tests/run.mjs            -> 20 passed, 0 failed
node skills/session-log/tests/run.mjs -> 18 passed, 0 failed
node scripts/link-skill.mjs status    -> 两个链接均指向 skills/<name>
git status --porcelain                -> clean
```

- PR #2 已 rebase 合并；`repo/workitem-close` 本地/远端分支已删除。
- `cmdClose` 已存在并通过 20 个测试（含 dry-run、pending 阻塞、happy path、已合并续跑、非工作项分支、脏 worktree）。
- 两个草案 worktree **不要动**：`.worktree/feat/flashcard-skills`、`.worktree/feat/init-project`。
- `.claude/skills/` 两个链接指向主检出；`.claude/settings.json` 只放行三个 `node scripts/*.mjs`，不要新增 `Bash(gh *)`。
- **2026-10-21 观察**：merge 后 `main` 的 push CI 可能长时间不出现（本次 >12 分钟）。它是审计记录，不是 gate；**不要 sleep 轮询、不要重复 push**。PR CI 与本地同一套 `check` 已通过即可。

### 0.2 本轮目标

用户的原话：这个开发流程已经很重，close 又增加了可阻塞的地方；初衷是减少迭代中的时间消耗和复杂度。

把用户侧的成功路径从 **4–5 次发言 / 5–7 份记录 / 6 个 close 预检** 压到：

- **2 句话**：开始；「UAT 通过，可以合并」。
- **2–3 份记录**：PR 正文（plan）、一轮 UAT 评论、`CHANGELOG.md`。
- **3 个必要预检**：worktree 干净、主检出在 `main`、PR 状态可用。

P0 只做低风险部分；P1（删 `sync`/`pending`）是行为变更，单独工作项；P2/P3 先讨论。

### 0.3 不要重复做的事

- 不要重做 `close`；它已合并并通过测试。
- 不要等待或轮询 merge 后的 `main` push CI。
- 不要新增 `Bash(gh *)` 权限；`gh` 只通过脚本或明确授权的单次命令调用。
- 不要动两个 `feat/*` 草案 worktree。
- 不要使用 `git worktree remove --force`，不要省略 worktree 内链接的移除。
- 不要把 P0、P1 合并成一个 PR；每一批单独走门槛。
- 不要为了“精简”再引入新的记录、新的状态文件或新的用户确认步骤。
- 不要修改已合并的 `docs/plan-workitem-close.md`（历史记录）。

## 1. 用户操作区

### 1.1 新 session 的执行提示

在仓库根目录打开新 session，把下面整段发给它：

```text
读取 docs/plan-workflow-simplify.md，执行 §5.1（P0）；§4 的推荐默认值直接采用。
先跑 §0.1 基线，再改；每完成一项跑对应测试。
完成后提交、推送、开 draft PR，等 PR CI 绿；self-review 只在有发现时写评论。
停在 merge 前，把 PR 链接和验证结果发给我；我回复「可以合并」后你直接执行，
不要再给命令清单，也不要等我二次确认 dry-run。
```

### 1.2 验收清单（P0）

- [ ] `README.md` 触发表只剩 3 行：开始、UAT 结果、可以合并；「收尾」「同步 main」不再作为用户触发词。
- [ ] `README.md` 明确允许「UAT 通过，可以合并」一句话；明确「可以合并」是唯一授权。
- [ ] `README.md` 不再要求用户先看 dry-run 输出；不再提 merge 后等 main push CI。
- [ ] `AGENTS.md` 的迭代流程压缩为 4 步（开始/实现/UAT/合并）；`uat save --final` 与 self-review 评论不再是必需产物。
- [ ] `AGENTS.md` 明确：授权后 agent 直接跑 `close --yes`；`--dry-run` 只在用户要求预览时使用。
- [ ] `cmdClose` 不再因主检出有无关改动而阻塞。
- [ ] `close` 的 `pull --ff-only` 移到 worktree 移除之前，pull 失败时 worktree 仍在，可重跑。
- [ ] 新增测试：主检出存在无关未跟踪文件时，`close --yes` 仍成功。
- [ ] `node scripts/check.mjs` 全绿；`scripts/tests/run.mjs` 连续两次结果一致（预期 21 个）。
- [ ] `CHANGELOG.md` 的 `[Unreleased]` 已记录。
- [ ] PR CI 绿；停在 merge 前，等用户「可以合并」。

## 2. 现状：重量在哪里

### 2.1 用户往返（当前 4–5 次 → 目标 2 次）

| # | 当前需要用户说 | 判断 |
|---|---|---|
| 1 | 开始 `<skill>` 的 `<topic>`：`<方案>` | 必要（方案对齐） |
| 2 | UAT 通过 / UAT 有问题 | 必要（唯一真实质量门） |
| 3 | 收尾 | 不必要，全是 agent 记账 |
| 4 | 可以合并 | 必要，但可与 #2 合并成一句话 |
| 5 | 看 dry-run 输出再确认 | 不必要，授权已给过 |

对应位置：`README.md:15-19` 的触发表、`AGENTS.md` 的「已升格 skill 的迭代」7 步流程。

### 2.2 记录产物（当前 5–7 份 → 目标 2–3 份）

| 产物 | 位置 | 判断 |
|---|---|---|
| `_dev/plan.md` | 本地 | 与 PR 正文重复；PR 正文足够 |
| `_dev/test-log.md` | 本地，随 worktree 删除 | 与 PR 评论重复，且不是持久记录；P2 再降级 |
| PR UAT 评论 | 远程 | 保留 |
| final approval 评论 | 远程 | 删除；merge 状态即记录 |
| self-review 评论 | 远程 | 删除；有发现才写 |
| `CHANGELOG.md` | 仓库 | 保留，唯一持久摘要 |
| `docs/plan-*.md` | 仓库 | 保留为跨 session 交接；合并后标记完成或删除，不当作永久记录 |

### 2.3 `close` 的 6 个预检（P0 砍 1 个、降级 1 个）

| 预检 | P0 处置 | 理由 |
|---|---|---|
| `pending: 0` | 保留到 P1 | P1 删除 sync/pending 后一起消失 |
| worktree 干净 | 保留 | 否则 merge 后 `git worktree remove` 才失败 |
| 主检出在 `main` | 保留 | 一行成本，避免操作错 checkout |
| 主检出干净 | **P0 删除** | 用户可能在 main 有无关改动；`pull` 不碰它们就能成功 |
| PR `OPEN`/`MERGED` | 保留 | 避免误 merge |
| `--sandbox` 是目录 | 保留 | 链接失败发生在 merge 之后，提前查避免半完成状态 |
| `--yes` + `--dry-run` 冲突 | 保留 | CLI 卫生，一行 |

配套：删除主检出干净检查后，把 `pull --ff-only` 从 worktree 移除之后移到 `fetch` 之后。这样 pull 失败时 worktree 还在，`close` 可重跑；否则会卡在“PR 已 merge、worktree 已删、分支还在”的半完成状态。

### 2.4 最大的隐藏复杂度：sync / pending 状态机（P1）

`scripts/workitem.mjs` 目前包含：

- `syncPath` / `loadSync` / `saveSync` / `addUpsert` / `addCommentPending` / `clearPending`
- `cmdSync` 及 `sync` 子命令
- `plan save` / `uat save` 各自的两套 gh 失败分支
- `status` 的 pending 行、`close` 的 pending 预检
- 三个专门测 pending 的用例

**建议整体删除**：gh 失败就直接非零退出并提示重跑。理由：

- plan 文件、commit、分支都在本地，重跑 `plan save` 会重建/更新 PR；
- `uat save` 已有 section 去重，重跑不会重复追加日志；
- 评论可能重复一次，但比一套状态机便宜。

这是本轮性价比最高的一刀，但属于行为变更，单独工作项。

### 2.5 结构级候选（P2/P3，先讨论）

1. **`repo/<topic>` 是最重的路径**：没有 `workitem` 自动化，却要手动 plan/PR/清理。建议 P2 评估让 `close` 支持 `repo/<topic>`（跳过 worktree/链接步骤），或至少明确“agent 静默执行、不交命令清单”。
2. **AGENTS 的 11 步与脚本双维护**：`close` 已测试后，11 步可压缩为“脚本即顺序，失败时按 `run:` 输出兜底”，细节留在代码里。
3. **worktree + 链接切换**：UAT 主要在独立 sandbox 时保留；否则可改为 main 检出上开分支，消掉 `.worktree`、链接移除顺序和 Windows junction 风险。
4. **空提交**：只为开 draft PR 而生；可保留，或延后到第一次内容 push 再开 PR。
5. **main push CI**：已决（2026-10-21）——删除 `push` 触发，保留 `pull_request`，加每天一次的
   `schedule` 审计 `main`（`17 14 * * *` UTC）。merge 不再产生 run；直接提交 main 的改动由当晚
   nightly run 覆盖。

## 3. 目标流程

```text
你: 开始 <skill> 的 <topic>：<方案>
agent: 实现 → 本地门槛 → push → CI → draft PR（全部内部）

你: UAT 通过，可以合并
agent: CHANGELOG + 一轮 UAT 评论 → 确认 PR CI 绿
       → close --yes（预检失败会先停；不再让你确认 dry-run）
       → 报告 done
```

失败时：

```text
你: UAT 有问题：…
agent: 同分支修复 → 重跑门槛 → 报告可再验收
```

没有「收尾」「同步 main」「可以合并」三次往返，也没有命令清单。

## 4. 决策点（推荐默认）

| # | 问题 | 推荐默认 |
|---|---|---|
| D1 | 成功路径 | 2 句话：开始；「UAT 通过，可以合并」 |
| D2 | 「收尾」触发词 | 删除；CHANGELOG/pending/CI/self-review 全部并入「可以合并」 |
| D3 | final approval 评论 | 删除；用户授权 + PR `MERGED` 即记录 |
| D4 | self-review 评论 | 删除；agent 内部 review，有发现才写 PR 评论 |
| D5 | dry-run 人工确认 | 删除；授权后直接 `--yes`，预检失败自然阻止 |
| D6 | test-log | P0 保留；P2 评估降级为可选草稿，UAT 只留 PR 评论 |
| D7 | sync/pending | P1 整体删除；失败即非零退出，重跑同一命令 |
| D8 | `repo/<topic>` | P0 只改文档为“agent 静默执行”；P2 再评估是否纳入 `close` |
| D9 | main push CI | 删除 `push` 触发，改每天一次 `schedule` 审计；不作为 gate、不等待 |
| D10 | worktree 去留 | P3 讨论，P0/P1/P2 不动 |

若新 session 没收到选择，按推荐默认执行，并在报告里注明。

## 5. 执行任务

### 5.1 P0（本轮必做，低风险）

#### 5.1.1 `README.md`

- 触发表从 5 行改为 3 行：
  - 「开始 `<skill>` 的 `<topic>`：`<方案>`」
  - 「UAT 通过」/「UAT 有问题：…」（并注明可以说「UAT 通过，可以合并」）
  - 「可以合并」：agent 直接执行 `close --yes`，不再先给你看 dry-run，也不交命令清单。
- 删除「收尾」与「同步 main」两行；在表下说明这两件事由 agent 自动处理。
- 「两个门槛」段：保留 CI + UAT；把 `pending: 0`、self-review 从用户检查项里移除，注明是 agent 内部步骤。
- 「手动命令」段：保留 `close --dry-run` / `close --yes`，但注明默认 dry-run、授权后 agent 直接 `--yes`；删除“合并后按 11 步执行”的强调，改为“agent 执行并验证”。
- 删除任何暗示 merge 后要等 main push CI 的句子。

#### 5.1.2 `AGENTS.md`

- 「已升格 skill 的迭代」的 7 步压缩为 4 步：
  1. 开始：讨论方案 → `plan save` → 分支/worktree + draft PR。
  2. 实现：同分支提交；每次 push 跑 `check.mjs`。
  3. UAT：真实使用；每轮最多一条 PR 评论；`--final` 不再是必需。
  4. 合并：用户说「可以合并」后，agent 更新 CHANGELOG、确认 PR CI 绿、跑 `close --yes`、报告；**不等待 main push CI，不交命令清单**。
- 删除或改写：`uat save --final` 作为关闭前必备、self-review 评论作为关闭前必备。
- 「关闭与清理顺序」：保留 11 步作为兜底，但明确“自动化路径优先，`close` 的内部顺序即规范；授权后直接 `--yes`，`--dry-run` 仅在用户要求预览或排查时使用”。
- 同步 `pull --ff-only` 的位置：改为 `fetch` 之后、链接/worktree 清理之前（与代码一致）。
- 「工作项自动化」的 `close` 条目：补充“授权后直接 `--yes`；预检失败会先停”。
- 「main 前进时的同步」：注明由 agent 在 UAT 前或合并前自动处理，不再作为用户触发词。

#### 5.1.3 `scripts/workitem.mjs` 的 `cmdClose`

- 删除主检出 `status --porcelain` 检查（保留“主检出必须在 `main`”检查）。
- 把 `step('git pull --ff-only origin main', ...)` 从 worktree 移除之后移到 `git fetch origin` 之后。
- 其余预检与顺序不动；`pending: 0` 保留到 P1。
- 更新 `--help` 的 close 段，说明 pull 在清理前执行（可选，保持简洁）。

#### 5.1.4 `scripts/tests/run.mjs`

新增一个测试：

```js
test('close does not block on unrelated main-checkout changes', () =>
  withRepo(({ repo, ghState, env }) => {
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    linkScriptInRepo(repo);
    planSave(repo, env, '# Plan: first\n');
    addContentCommit(worktree);

    // Unrelated dirt in the main checkout must not block close.
    fs.writeFileSync(path.join(repo, 'notes.txt'), 'scratch\n');

    const r = closeWorkItem({ repo, worktree, env });
    assert.match(r.stdout, /close complete/);
    assert.equal(readGh(ghState).prs[0].state, 'MERGED');
    assert.ok(fs.existsSync(path.join(repo, 'notes.txt')));
  }));
```

预期从 20 个测试变为 21 个；现有 20 个不得删除或弱化。

#### 5.1.5 `CHANGELOG.md`

`[Unreleased]` 的 `Changed` 记录：成功路径压到 2 句话；删除收尾/同步 main 触发词与 final approval/self-review 产物；`close` 不再因主检出无关改动阻塞；`pull --ff-only` 移到清理前以保证可重跑。

#### 5.1.6 验证与提交

```bash
node scripts/check.mjs
node scripts/tests/run.mjs
node scripts/tests/run.mjs   # 重复一次，输出应一致
node skills/session-log/tests/run.mjs
git diff --check
sh .githooks/pre-commit
```

建议 2 个提交：

1. `feat(tooling): keep close runnable with unrelated main changes`
2. `docs(repo): simplify the user-facing workflow`

推送后开 draft PR（正文 = 本文件的 §0–§5.1 摘要或全文），等 PR CI 绿；self-review 只在有发现时写评论。停在 merge 前。

### 5.2 P1（单独工作项：删除 sync/pending）

**目标**：gh 失败即失败，重跑同一命令；不再有 `sync.json`、`pending`、`sync` 子命令。

改动点：

- 删除 `syncPath` / `loadSync` / `saveSync` / `addUpsert` / `addCommentPending` / `clearPending` / `cmdSync` 及 `sync` 分发与 USAGE 行。
- `cmdPlanSave`：push / list / edit / create 失败时直接 `die(...)`，提示“修复后重跑 `plan save`”；本地 plan 与 commit 保留。
- `cmdUatSave`：gh 失败时直接 `die(...)`；`appendSection` 的去重保留，重跑不会重复写日志。
- `cmdStatus`：删除 pending 行，只显示 branch/worktree/PR。
- `cmdClose`：删除 `pending: 0` 预检。
- 测试：
  - 删除 3 个 pending/sync 用例。
  - 新增：`FAKE_GH_FAIL=comment` 时 `uat save` 非零退出；去掉失败注入后重跑成功，且 PR 只有 1 条评论。
  - 新增：`FAKE_GH_FAIL=create` 时 `plan save` 非零退出；重跑后 PR 创建成功。
  - 修正 `close` 测试中依赖 pending 的用例。
- `README.md` / `AGENTS.md`：删除 `sync` 命令与 `pending: 0` 相关表述。
- `CHANGELOG.md`：`Removed` 记 sync/pending 状态机；`Changed` 记失败策略。

风险：评论可能重复一次。可接受；如不接受，改为 `gh pr view --json comments` 扫描去重，但会增加一次 gh 调用。

### 5.3 P2（需用户确认后，独立工作项）

- **一份 UAT 记录**：`uat save` 只发 PR 评论；`_dev/test-log.md` 降级为可选本地草稿，不再是流程交付物。
- **`repo/<topic>` 轻量路径**：评估 `close` 支持 repo 分支（切回 main → ready/merge → pull → 删本地/远端分支），或维持手动但明确“agent 静默执行”。
- **压缩 AGENTS 11 步**：把详细顺序移到 `docs/` 或脚本注释；AGENTS 只保留“链接先于 worktree 删除”等不变量。
- **plan 文档**：保留为跨 session 交接，合并后标记完成或删除；不当作永久记录。

### 5.4 P3（只讨论，不实现）

- worktree 去留（改为 main 检出上开分支）。
- 空提交与 PR 创建时机。
- ~~`main` push CI 是否保留 `push` 触发。~~ 已决（2026-10-21）：删除 `push` 触发，改 nightly
  `schedule`；见 D9、§2.5 第 5 条与 CHANGELOG。

## 6. 验收清单（P0）

- [ ] 用户侧成功路径只需 2 句话；README 无「收尾」「同步 main」触发词。
- [ ] README/AGENTS 明确「可以合并」是唯一授权，agent 直接执行，不交命令清单。
- [ ] final approval 与 self-review 评论不再是必需产物。
- [ ] `cmdClose` 不因主检出无关改动阻塞；`pull` 在清理前执行。
- [ ] 新测试覆盖“主检出有无关未跟踪文件仍可 close”。
- [ ] `check` 8/8；`scripts/tests` 21/21 连续两次一致；`session-log` 18/18。
- [ ] CHANGELOG 已记录。
- [ ] PR CI 绿；停在 merge 前等用户确认。

## 7. 交接注意

### 7.1 本轮的 contradiction（必须在 P0 修掉）

`docs/plan-workitem-close.md §1.1` 要求 agent 在 merge 前把命令清单交给用户确认；但 `README.md:21` 与 `AGENTS.md` 已规定「可以合并」是唯一授权、agent 自行执行。**以 README/AGENTS 为准**。P0 的文档改写必须消除这个矛盾；未来的 plan 文档不得再要求用户复制命令。

### 7.2 不要等待 main push CI

2026-10-21 实测：merge 后 `main` 的 push run 超过 12 分钟仍未出现在 Actions 列表。PR CI 与本地同一套 `check` 已通过；它是审计记录，不是 gate。查一次即可，不要 sleep 轮询。

后续（同日）：`push` 触发已删除，`main` 改由 nightly `schedule` 审计。本节仅存历史，不再有需要等待的 merge push run。

### 7.3 权限与 gh

- 只放行 `node scripts/{workitem,check,link-skill}.mjs`；不要新增 `Bash(gh *)`。
- `close` 的 gh 调用留在脚本内；手动 merge/ready 只在用户明确授权后执行。
- `gh pr checks <n>`、`gh pr view` 等只读命令可按需单次调用。

### 7.4 不要宣称已验证

- fake-gh 只证明命令顺序与状态收敛。
- 真实 `gh pr ready` / `gh pr merge --rebase` 只有在下一次真实 skill 工作项 dogfood 后才能说“已验证”。
- 若本轮用真实仓库验证过，请在报告里写明验证方式。

### 7.5 已知但不属于 P0 的问题

- `session-log --json` 不一致（`transcript` 忽略、`usage` 追加人类可读行、`get` 是 no-op）。
- `gh pr list --state all` 可能命中已关闭未合并的 PR；分支名不复用。
- `plan save` 只创建空提交；无内容就 merge 可能被 GitHub 拒绝。
- `close` 在 worktree 已被移除后不能续跑（P2 再评估）。

## 8. 命令速查

```bash
# 基线
node scripts/check.mjs
node scripts/tests/run.mjs
node skills/session-log/tests/run.mjs
node scripts/link-skill.mjs status
git status --porcelain

# P0 验证
node scripts/check.mjs
node scripts/tests/run.mjs
node scripts/tests/run.mjs
node skills/session-log/tests/run.mjs
git diff --check
sh .githooks/pre-commit

# close（授权后）
node scripts/workitem.mjs close --yes
node scripts/workitem.mjs close --dry-run   # 仅在用户要求预览时

# repo 分支合并（用户确认后；无 worktree）
gh pr ready <n>
gh pr merge <n> --rebase
git switch main
git pull --ff-only origin main
git branch -D repo/<topic>
git push origin --delete repo/<topic>
git worktree list
```
