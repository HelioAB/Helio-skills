# grill-x v3 修改与测试计划

日期：2026-10-17。状态：**已实施（同日，C1–C4 落地、尾注升 v3）——待复测（T8 单场；原 T2/T5 场次于 2026-10-19 裁并进 T8）**。D5/D6 同日拍板均为 (b) 维持现状、不实施，决策记录见各节。
证据来源：T4′（transcript `d36ff45d-859d-4ed2-bf3d-5139de900916`）与 T6（transcript `26f45aa1-eeb9-4449-b6ca-347aca8ca722`），结论见 `test-log.md` 对应节。v2 计划见 `plan.md`（已实施并验证，封存）。

## 背景

v2 三处修复经 T4′/T6 验证全部生效：逐轮落盘（T6 含开篇落盘与 R3 正确不写）、白名单封闭（T6 在直接读取污染源 `test-01/plan.md` 的情形下仍成立）、共识逐项忠实。遗留四件事构成 C1–C4：

- 两处已定位根因的失效：R1 写作步轮内滑落一轮并虚报"已落盘"（T4′，下轮自纠）；写入位置判据 "repo" 不可靠（T4′/T6 两场均被 harness 注入的 git 元数据误导——T6 元数据称 branch master + staged 文件而目录实无 .git，模型两场均零自查调用）。
- 两处正面即兴行为待成文：问题编号跨轮全局连续；默认小决定清单（否决窗口 + 收官复述）。

## 改动清单（只动 SKILL.md；英文行文；尾注升 v3 一行，概述 C1–C4〔及 D5/D6 若实施〕）

### C1 问题编号跨轮连续（Output format 首段）

现状只规定轮内编号（"number the blocks Q1, Q2, …"），轮间关系未定——T4′ 的连续编号属即兴，且被后续问题块背景引用与收官共识的 (Q#a) 标注承重；每轮重置会使引用退化为二维（轮次×编号），每一处引用都是犯错机会。草案（插入点：首段 "…separate blocks with a horizontal rule (`---`)." 之后）：

> Numbering is session-wide: it continues across rounds (round 2 starts at Q7 if round 1 ended at Q6) and a number is never reused, so a bare Q-number identifies one question anywhere later in the session — in later rounds' backgrounds and in the closing consensus.

### C2 默认小决定条款（Protocol 第 3 段之末，"put each to them and wait." 后另起）

T4′（6+4 条）与 T6（2 条）两场均自发出现同一形态：轮末编号默认清单 + 否决邀请 + 收官单独成节复述。解决"琐事要么占问题块、要么被沉默假设"的老问题；成文并加护栏防止清单变成沉默假设的马甲。草案：

> Trivial, easily reversed details — a sort order, copy wording, a limit with an obvious default — do not merit question blocks. Decide them yourself, but never silently: list them at the end of the round as numbered defaults with an invitation to object, and restate all standing defaults in the closing consensus. The moment such a detail is hard to reverse, changes scope, or would surprise a future reader, it is a question block, not a default.

末句护栏与 ADR 三判据同构（难逆转 / 意外 / 真取舍 → 改范围与惊讶各占其一）。

### C3 写作步硬槽位（Docs mode 段 2 整段替换）

T4′ R1 失效根因：写作步被排在该 turn 事实核查之后，出题时丢步，且文本虚报"已落盘"；v2 锚点（答案后、下轮问题前）之间合法插入其他工作，丢步窗口仍在。T6 未复发属运气证据而非根因消除。草案：

> In docs mode the round loop gains a write step. Whenever something newly settles — at the opening, or the moment a round's answers arrive — run this write step first, before any other work in the turn (fact-finding included): write every newly resolved term into CONTEXT.md, evaluate every newly settled decision against the ADR criteria, and write qualifying ADRs at once. Only then move on to facts and to the next round's questions. This writing is part of the loop, not a closing deliverable. Never save it up for later and never announce such an intention — deferring the writes "until we're done" is itself a violation; equally, never report a file as written before its write has actually run. These writes do not count as acting on the plan.

（"at the opening" 一并硬化 T6 的开篇落盘行为；末句增补封死虚报："已落盘"必须晚于 Write 结果。）

### C4 写入位置触发条件重写（Docs mode 段 4 整段替换）

现状 "Outside a repo" 以 git 为隐含判据，两场均被环境元数据误导。弃选替代方案"以 `git rev-parse --show-toplevel` 结果等于工作目录为准"：仍以 git 为判据，会把 T4′ 的无 .git 真项目（应落根）误判去 topic 子目录。改按目录自身内容判定（意图式：多话题共目录才隔离）。草案：

> When the working directory is itself a project's root — it holds one coherent source tree with its manifests and README — CONTEXT.md and `docs/adr/` sit at that root. Otherwise (a bare topic folder, or a folder collecting files from several topics), both paths live inside one subdirectory named after the topic: create it at the first write and state its location then. Judge this from what the directory itself contains, not from ambient git status — it can describe a different directory. A location the user names always overrides either default.

四场证据对照：T4′（真项目根）→ 落根，由"字面违规"转合规；T6、T4 v1（多话题混杂）→ topic 子目录，修复失效/制度化原即兴行为；T1（裸沙盒）→ 子目录，与原行为一致。Protocol 收官句的交付物兜底（无条件 topic 子目录）不动——docs 文件是项目构件、收官交付物是会话构件，不对称是有意保留。

## 待拍板决策（T6/累计证据新暴露，超出已同意的 C1–C4）

### D5 格式标签语言

- 现状：模板全英文，标签去留未规定。T4′ 标签随对话译中文（我的建议/理由/选项/推荐/自行提出），T6 保留英文（My recommendation/Reason:/Options:/Background:）——同构场景两场分歧，纯即兴。
- (a) 放宽。Output format Rules 加一条：**（推荐）**

  > Template labels (`My recommendation`, `Reason:`, `Options:`, `(recommended)`, the open option) may be rendered in the conversation language; the structure — bold forms, letter sequence, ordering — stays fixed.

  动机与 v2 全文英文化同源：skill 文本语言不应牵动输出语言。
- (b) 维持模板字面：标签恒英文，一致性利于判读与跨语言扫描。

**用户决策**（2026-10-17）：b，维持现状——标签语言继续作为语言跟随观察项记录，不作合规判据。

### D6 收尾字母作答提示句

- 现状：Rules 第 2 条要求收尾问句引用字母，但模板块内无收尾行示例，锚定不可靠——T1（R3/确认轮缺）、T6（三轮全缺）漏-render，T4′ 全有；用户裸字母作答均无障碍。
- (a) 结构性锚定。Output format 首段（C1 句之后）加一句：**（推荐）**

  > Close each round of blocks with one line inviting bare-letter answers, e.g. `Reply with bare letters (Q1: a / Q2: b / …)`.

- (b) 维持不修（无功能损害，历次用户均照常裸字母）。

**用户决策**（2026-10-17）：b，维持现状——缺失时照 T1/T6 类别记录小瑕疵，不作判据。

## 实施步骤（职责分离沿用 v2 plan：仓库侧管开发，沙盒侧只是被测对象）

1. （仓库侧 agent）按 C1–C4 改 `drafts/grill-x/SKILL.md`；D5/D6 拍板为 (a) 的一并实施；尾注加 v3 行（英文）。
2. （用户或仓库侧）部署新沙盒（如 `sandbox__003`）：只拷 SKILL.md + references/（D4 沿用，排除 `_dev/`；两份部署副本同此）。
3. （用户，沙盒侧会话中作答）按下节跑 T8 单场，按应答脚本把原 T2/T5 考察点一并跑完。
4. （仓库侧 agent，用户在仓库目录另起会话发起）按 transcript ID 定位 JSONL → 判读 → 回填 `test-log.md`（T8 新起一节，含并入项结论；T2/T5 既有节已各补一句裁并记录）。

## 测试计划（v3 后，T8 单场定胜负）

2026-10-19 用户裁并：取消原拟的 T2 重测与 T5 独立场次，全部考察并入 T8 一次跑完——两者的实际功能已经既有各场验证（裸字母作答历场无障碍；frontier 随答案正向重塑在 T1 R2/R3、T4′/T6 多轮均有实证），不值得再各开一场。随之裁掉、不再补测：普通模式（非 docs）下的 C1 观察（C1 措辞本身不限模式，docs 场验到机制即可）；T5 的"中途要术语表"（考察的是 docs 中途激活，而 T8 全程 docs 激活，失去考察对象）。

### T8 v3 回归 + 行为压力（docs 端到端，单场一次完成）

- 准备：新一次性沙盒目录，预置 1–2 个兄弟话题目录（各含 plan.md / log.md 类文件，制造污染源）；确保目录**不是**单一项目根（无整树/清单/README 结构）。话题另选术语密度高的新题（避开菜园、课程评论语境）。
- 开场：`/grill-x docs <话题>`。
- 应答脚本（原 T5 织入作答方式，判读按下列对应判据记）：
  - 全程裸字母作答（`Q1: a / Q2: d` 式）；其中一问（真决策）不选字母，只答"都行，你定"。
  - R2 或 R3 中途推翻一项早前已落定的答案，挑连锁影响明显的根级决策——同时充当"答案重塑 frontier"的最强形式（原 T2 核心；正向重塑已有 T1/T4′/T6 旁证，不再单测）。
  - 收官前某轮插入一次"别问了，直接开始干"。
- 判据：
  1. **C3**：每个答案后 turn（含 R1），若有新落定内容，Write/Edit 先于该 turn 内一切 Read/Grep/Agent；文本"已落盘 / written"类表述晚于对应 Write 结果。推翻答案后的连锁改写同判（原 T5-3：对应子树重开，CONTEXT/ADR 随新答案同步改）。
  2. **C4**：首次写入落 topic 子目录并于当时声明位置；判读核对 thinking/文本未以环境 git 状态为依据。
  3. **C1**：编号跨轮连续，无重置无复用；跨轮引用用裸编号。
  4. **C2**：默认清单（若出现）带否决邀请、收官复述；逐项核对无难逆转/改范围项混入。真决策上答"都行，你定"不得借 C2 默默落定——须显式定局（按推荐确认或收紧后重问均可）并进收官共识；若把真决策塞进默认清单，记失效（原 T5-2）。
  5. 沿用断言：产出封闭于 CONTEXT.md + `docs/adr/*.md`；无推迟表述；共识逐项忠实（含写入位置与实际一致）；格式照模板（收尾字母提示句缺失照 T1/T6 类别记小瑕疵——D6 已拍 b）；无 emoji；语言跟随（标签语言照 D5 拍板 b 继续观察，不作判据）。
  6. 有效性核验（T6 教训固化为常规）：被测会话无对本仓库 `_dev/` 任何文件的 Read——命中即该场作废。
  7. 守住不动手（原 T5-4）："别问了，直接开始干"之后仍不得动手执行计划——剩余关键决策照常问出（可压缩为最后一轮），共识未经确认前保持零白名单外动作。
- 后备：C3 若再滑落，启用 v2 plan 既有后备手段（reference 增补轮次绑定措辞），届时另议。

### T3（降级为可选）

T4′/T6 已预演其大半（事实自查找、探索不阻塞、矛盾变标准问题块）；仅剩预置合成矛盾（SQLite vs postgres）场景未覆盖，优先级最低。

T8 单场全过（含并入项）后议升格 `skills/`（升格提交随记 CHANGELOG；drafts 阶段不记）。

## 范围外（记录，不改）

- 跨目录事实探查（T6 观察项）：Protocol 不加范围限制——探查对题目质量有实证贡献且量克制；泄露风险由判读侧固定核验（T8 判据 6）兜住，不为测试便利污染 skill 规则。
- 收官确认用自由式确认句而非标准问题块（T6）：功能齐备，不规。
- docs 产出语言跟随对话而非仓库语言（T4′/T6 均中文产出、目标库全英文）：T8 继续观察，成扰再议。
