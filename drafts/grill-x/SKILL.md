---
name: grill-x
description: Grill the user relentlessly about a plan, decision, or idea. The "docs" argument additionally turns resolved terms and decisions into a glossary (CONTEXT.md) and ADRs. Use when the user explicitly invokes this skill by name (/grill-x or /grill-x docs).
---

# Grill-X — personal edition

A relentless interview to sharpen a plan or design. This directory is the complete, self-contained skill: do not call, load, or route to any other skill (grilling, grill-me, grill-with-docs, domain-modeling, or anything else).

## Protocol

Interview the user relentlessly until you reach a shared understanding. Map the work as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you have not heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round. The user's answers reshape the tree: settled decisions push the frontier outward and unblock the questions that depended on them. A question whose answer depends on another question still open in this round belongs to a later round, not this one.

Finding **facts** is your job, never the user's. When a question needs a fact from the environment (filesystem, code, docs, tools), find it yourself — read files, dispatch a sub-agent — instead of asking. Do not block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now. The **decisions** are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on the plan until the user confirms you have reached a shared understanding.

## Output format

Each question is one self-contained block. In a round with multiple questions, number the blocks Q1, Q2, … and separate blocks with a horizontal rule (`---`). Render each block exactly like this:

```md
**Q1 - <question title>**

<背景：可选。仅当存在影响回答、用户可能不知道的事实或矛盾时才写，不超过两句；你查到的事实放这里，不放正文段落。没有就整段省略。>

**My recommendation**: **<答案要点>**
理由：<为什么胜过最接近的替代项。只对比已列出的取舍，不引入选项行之外的新论据；通常 1–3 句。>

可选方案：
- **(a) <方案名> (recommended)** – <一行取舍>
- **(b) <方案名>** – <一行取舍>
- **(c) <方案名>** – <一行取舍>
- **(d) 你的方案** – <以上都不合适时，描述你自己的想法>
```

Rules:

- The listed options must be a genuine, best-effort enumeration of the space. The open option — always last, its letter following the sequence — is a safety valve, not a substitute for enumerating well.
- The closing question references options by letter, so the user can answer with a bare letter.
- No emoji anywhere.

## Docs mode

Active only when the invocation includes the argument "docs" (`/grill-x docs`), or when the user asks for docs, ADRs, or a glossary mid-session. When it activates, read references/domain-modeling.md and apply it for the rest of this session. Terms or code contradictions you find become questions, rendered in the standard output format above.

<!-- v1, 2026-10-09: 初始自用版。docs 纪律与两份格式文件在 references/。迭代时直接编辑本目录内文件。 -->
