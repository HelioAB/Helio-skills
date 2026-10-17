# grill-x 修复计划：docs 模式批处理失效与计划外交付物

日期：2026-10-14；2026-10-15 并入 T1 首测发现。证据来源：T4 transcript `1354bf72-3e01-4187-8f09-ff6dfecad8d1`、T1 transcript `3309fa67-b887-46f4-9906-cfdf2da5ea1a`（结论见 `test-log.md` T4/T1）。
状态：v2 已实施（2026-10-15，commit 7c0531d）。T4′+T7、T6 均已测并判读（2026-10-17，见 `test-log.md` 对应节：P1/P2/P3 修复全部见效；残留 R1 写作步滑落+虚报"已落盘"、"repo" 判据不可靠（T6 确证机制）、两处正面即兴行为待成文）。**本文件就此封存**：v3 修改与测试计划移交 `_dev/plan-v3.md`。

## 问题与根因

### P1 docs 写作被批处理到收官（核心失效）

- 现象：CONTEXT.md 与两个 ADR 在"第三轮落定"时一次性写出（asst#16-18），此前的轮次中零写入。第 2 轮已识别 ADR 触发（asst#11）却只标记不写；第 3 轮公开预告"届时一并落盘"（asst#13）并在 frontier 未清空时宣布"现在落盘 docs"（asst#15）。
- 根因：主文件 Protocol 的轮次循环（问 frontier → 等答案 → 重算 → 再问）是自洽完备的，写作在其中没有槽位；Docs mode 段对 docs 模式的唯一具体行为描述是"术语/矛盾变成问题"（提问增强），写作纪律只活在二跳 reference 里。模型于是把写作放进整个 skill 唯一的"等待后产出"槽位——收官交付，并自建"最后统一落盘"叙事、当作与用户的约定执行。reference 中 "Don't batch these up" 措辞已足够强，输给的不是措辞而是结构。
- 附带：frontier 未清空即落盘（P4）属同一失效的表现——写作时机由模型叙事而非规则决定，随 P1 消解，不单独改文。

### P2 计划外交付物：模仿目录中既有异构文档

- 现象：docs 模式额外产出 `plan.md`、`log.md`、`calendar.md`（asst#19/21/22）。
- 归因：开场 Glob `*` 返回兄弟目录 `test-01\`（另一场健身话题会话）的 `plan.md`/`log.md`/`transcript.md`，模型把既有文档当成了产出模板（calendar.md 为自创延伸）。
- 根因：skill 未定义 docs 模式产出物的封闭集合，也未限定"读取现有文件的目的"。真实项目中不同模块的文档因模块特性而异、并存是常态，若不封死，任何目录里的既有文件都可能被误当模板。

### P3 非 repo 场景写入位置未定义（T1 普通模式复现并加重）

- 现象（T4，docs 模式）：自创 `garden/` 子目录放置 CONTEXT.md 与 ADR。本例无害，但无规则依据；换成直接写 cwd 根或写到别处同样说得通——即兴行为。
- 现象（T1，普通模式，2026-10-15 并入）：R1 Q6 选项 (a) 与共识表格写"放当前目录"，骨架段与确认块却写 `fitness/`，实际写入自创 `fitness/` 子目录（asst#95/99）。加重在于共识摘要自相矛盾——用户 Q6 答的是"当前目录"，最终确认的却是骨架的 `fitness/` 版本，同意链条存在但不干净。
- 根因（T1 加重后分两层）：
  - 位置无规则：对一切落盘（docs 文件与收官交付物）的写入位置均无规则，T4 的 `garden/` 与 T1 的 `fitness/` 同根。
  - 共识摘要无忠实性约束：收官复述/骨架属模型即兴，无"逐项如实复述用户已确认答案"的要求，矛盾由此漏进确认环节。
- D1 已定（b：topic 子目录，用户指定优先；范围扩至一切落盘）；忠实性句见修复方案第 2 处。

## 修复方案

**只改一个文件：`drafts/grill-x/SKILL.md`**，共两处结构性改动，另有全文英文化（见下节，只译措辞不动结构）：

1. **Docs mode 段整段重写**（草案见下）——对应 P1/P2。
2. **Protocol 收官段加一句共识忠实性规则**——对应 P3 第二层根因（共识摘要自相矛盾）。T1 是普通模式，此句落不进 Docs mode 段；与 D3 的取舍不同，这里是绕不开 Protocol 的一处，但仅一句、非结构性改动。草案句：

   > Restate the consensus faithfully, item by item as the user answered it. Deliverables go exactly where the user confirmed; if no location was ever settled, gather them into a topic-named subdirectory of the current directory and say so, rather than silently inventing one.

`references/domain-modeling.md` 与两份格式文件不动：失效根源在主文件结构，且 reference 措辞已是最强表达；若复测仍批处理，再考虑在 reference 增补轮次绑定措辞（后备手段，不在本计划内）。

### Docs mode 段重写草案

```md
## Docs mode

Active only when the invocation includes the argument "docs" (`/grill-x docs`), or when the user asks for docs, ADRs, or a glossary mid-session. When it activates, read references/domain-modeling.md and apply it for the rest of this session. Terms or code contradictions you find become questions, rendered in the standard output format above.

In docs mode the round loop gains a write step. After each round of answers and before generating the next round's questions: write every newly resolved term into CONTEXT.md, and evaluate every newly settled decision against the ADR criteria, writing qualifying ADRs at once. This writing is part of the loop, not a closing deliverable. Never save it up for later and never announce such an intention — deferring the writes "until we're done" is itself a violation. These writes do not count as acting on the plan.

Docs mode touches exactly two kinds of files: CONTEXT.md and `docs/adr/*.md`. Files already present in the directory — plans, logs, notes from this or other topics — are evidence to mine for facts and contradictions, never templates to imitate: do not create, extend, or mirror any other document on their model. Anything beyond the two files belongs to the action phase and waits for confirmed consensus.

Outside a repo, both paths live inside one subdirectory named after the topic: create it at the first write and state its location then. A location the user names always overrides this default.
```

草案要点与问题的对应：第 2 段 = P1（写作入循环 + 显式封杀"届时一并落盘"式预告 + Do-not-act 豁免）；第 3 段 = P2（白名单 + "证据非模板"）；第 4 段 = P3/D1（非 repo 默认 topic 子目录，用户指定优先）。

## 全文英文化（2026-10-15 增补）

动机：泛用性。skill 文本的语言不应牵动输出语言——英文 skill 应能服务任何语言的用户。

范围只 SKILL.md（references/ 三份文件已全为英文，不动）：

- Output format 模板块内全部中文转英文：`<背景：…>` 注解、`理由：`、`可选方案：`、`<方案名>`、`(d) 你的方案` 及其说明行。Q 编号、`My recommendation`、a–d 字母本就英文，照旧。
- 尾注 v1 中文注释行转英文；v2 行随本计划各改动新增时直接以英文写。
- 正文与 frontmatter 已是英文，无需改。

语言规则暂不加（不写 "respond in the user's language" 类指令）：skill 是否天然跟随用户语言交 T7 检验；若 T7 失败，再考虑加一句显式规则（后备手段，不在本计划内）。

## 决策记录（2026-10-15 定案）

### D1 非 repo 场景的写入位置（P3；范围含 docs 文件与收官交付物）

- 适用范围：规则一句两用——Docs mode 段末句（上方草案第 4 段），Protocol 忠实性句引用同一规则兜底"从未定过位置"的情形。
- (a) 直接写 cwd 根。最简单，但同目录多话题会互相覆盖、混杂——恰是 T4 沙盒的风险场景。
- (b) 按话题建子目录（制度化 T4 `garden/` 的即兴做法），首次落盘时说明位置。话题间天然隔离，与 domain-modeling 的 context 概念同构。**（推荐）**
- (c) 首次写入前作为问题块问用户。最保守，但为低风险小事占用一轮提问，违背"事实/小事自决"的精神。T1 的教训是问完不自守——若选 (c)，必须与 Protocol 忠实性句捆绑生效。

**用户决策**：b，但是保留用户指定目录位置的可能性

### D2 每轮 docs delta 行（可选增强）

每轮输出末尾加一行"本轮写入/无"，使写作即时可见。**推荐不加**：写动作在 UI 中本就可见（本次失效正是由此发现），加行是持续噪音；若复测仍批处理再加不迟。

**用户决策**：不加

### D3 "Do not act on the plan" 豁免的落点

- (a) 只在 Docs mode 段说明"这些写入不算 acting on the plan"（草案现方案）。**（推荐）**
- (b) 另在 Protocol 那句原文处加括号豁免。更显式，但 Protocol 为非 docs 模式共享，改动最小化原则下不必动。

**用户决策**：a

### D4 沙盒部署副本清理

沙盒里 `.claude/skills/grill-x`（会话实际加载路径）与 `.agents/skills/grill-x` 两份部署副本均含 `_dev/`（test-log、旧 plan 会泄入运行环境）。**推荐**：复测部署时排除 `_dev/`，只拷 SKILL.md 与 references/。

**用户决策**：用户复测时手动删除

边界澄清（2026-10-15 补）：删除只针对沙盒两份部署副本；仓库 `drafts/grill-x/_dev/` 是测试记录唯一本体，不删、不随部署拷贝。测试会话自身不写任何测试记录（这也是删 `_dev/` 防污染的另一半目的）——判读与回填只属仓库侧 agent，由用户届时手动在仓库目录发起（与沙盒测试会话不是同一个 agent），数据源是按 transcript ID 定位的沙盒会话 JSONL（见实施步骤职责分离与第 4 步）。

## 实施步骤（定案后）

职责分离（2026-10-15 补）：本流程跨两类互不相同的 agent 会话——**仓库侧**（在本仓库目录运行，管开发：改文、部署、判读、回填）与**沙盒侧**（在沙盒目录运行部署副本，只是被测对象，不读不写任何测试记录）。二者不是同一个 agent：沙盒测试结束后，结论不会"自动"流回仓库——判读回填要等用户手动在仓库目录运行 agent 才发生。各步执行者：

1. （仓库侧 agent）按草案改 `drafts/grill-x/SKILL.md` 两处——Docs mode 段（含 D1 句）、Protocol 收官句；全文英文化（见"全文英文化"节）；尾注升 v2 一行（英文）。
2. （仓库侧 agent 或用户手动）部署到沙盒（D4：复测时用户手动删除两份部署副本中的 `_dev/`；只动沙盒副本，仓库 `drafts/grill-x/_dev/` 不动）。
3. （用户，沙盒侧会话中作答）复测：
   - **T4′ 重跑**（换一个术语密度高的话题，避免与首测语境混淆）。判据（JSONL 解析，脚本临时重建即可）：每轮答案落定后、下一轮问题前出现 Write/Edit CONTEXT.md；全程无"稍后/届时统一落盘"类表述；frontier 清空前不出现白名单外文件；格式合规照英文化后模板；写入位置符合 D1（用户指定优先，否则 topic 子目录）；收官共识摘要与实际写入位置逐项同用户已确认答案一致（P3 第二层）。
   - **T6 新增（污染场景）**：在预置兄弟话题 `plan.md`/`log.md` 的目录（可直接复用 `test-01`）跑 docs 模式，断言只产出 CONTEXT.md 与 `docs/adr/*.md`。
   - **T7 新增（语言跟随，随英文化增补）**：英文 skill 下用户全程中文，可与 T4′ 同场叠加省一场。判据：问题块正文（背景、问题、选项、理由）与收官共识摘要为中文。观察项：格式标签（`My recommendation`/`Reason:`/`Options:` 等）照模板保留英文还是随语言译成中文——后者不判违规，回头再定模板措辞是否放宽；docs 产出（CONTEXT.md/ADR）的语言。
4. （用户手动在仓库目录运行 agent，与步骤 1 的会话无关）判读与回填：按 transcript ID 定位沙盒会话 JSONL → 解析判读 → 回写仓库的 `drafts/grill-x/_dev/test-log.md`（不是沙盒副本，彼时已删 `_dev/`，且本就不该由测试会话写）。T4′ 与 T6 各记一节；T7 叠加于 T4′ 则并入其节记语言跟随观察，单独跑则自记一节。
5. CHANGELOG：drafts 阶段不记；升格进 `skills/` 时随升格提交一并记。

## 范围外

- T2 重测、T3、T5 尚未执行，不在本计划内（T1 已执行，两处小瑕疵：P3 并入本计划；字母提示缺失不修，轻微且无功能损害，仅记于 test-log）。Protocol 的改动仅限本计划列明的一句；Output format 仅译模板注解，规则与结构不动。
