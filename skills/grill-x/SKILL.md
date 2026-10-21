---
name: grill-x
description: Grill the user relentlessly about a plan, decision, or idea. The "docs" argument additionally turns resolved terms and decisions into a glossary (CONTEXT.md) and ADRs. Use when the user explicitly invokes this skill by name (/grill-x or /grill-x docs).
---

# Grill-X — personal edition

A relentless interview to sharpen a plan or design. This directory is the complete, self-contained skill: do not call, load, or route to any other skill.

## Protocol

Interview the user relentlessly until you reach a shared understanding. Map the work as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you have not heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round. The user's answers reshape the tree: settled decisions push the frontier outward and unblock the questions that depended on them. A question whose answer depends on another question still open in this round belongs to a later round, not this one.

Finding **facts** is your job, never the user's. When a question needs a fact from the environment (filesystem, code, docs, tools), find it yourself — read files, dispatch a sub-agent — instead of asking. Do not block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now. The **decisions** are the user's: put each to them and wait.

Trivial, easily reversed details — a sort order, copy wording, a limit with an obvious default — do not merit question blocks. Decide them yourself, but never silently: list them at the end of the round as numbered defaults with an invitation to object, and restate all standing defaults in the closing consensus. The moment such a detail is hard to reverse, changes scope, or would surprise a future reader, it is a question block, not a default.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on the plan until the user confirms you have reached a shared understanding. Restate the consensus faithfully, item by item as the user answered it. Deliverables go exactly where the user confirmed; if no location was ever settled, gather them into a topic-named subdirectory of the current directory and say so, rather than silently inventing one.

## Output format

Each question is one self-contained block. In a round with multiple questions, number the blocks Q1, Q2, … and separate blocks with a horizontal rule (`---`). Numbering is session-wide: it continues across rounds (round 2 starts at Q7 if round 1 ended at Q6) and a number is never reused, so a bare Q-number identifies one question anywhere later in the session — in later rounds' backgrounds and in the closing consensus. If a drafted question collapses into a default instead of being printed, its number burns: the sequence skips the gap (Q6 → Q8) and never backfills it. A gap is harmless — a bare Q-number still names exactly one printed question. Render each block exactly like this:

```md
**Q1 - <question title>**

<Background: optional. Include only when a fact or contradiction affects the answer and the user may not know it; two sentences at most. Facts you have looked up go here, not into the body. Omit the whole block when there is none.>

**My recommendation**: **<answer in brief>**
Reason: <why it beats the closest alternative. Compare only the trade-offs already listed; introduce no new arguments beyond the option lines; usually 1–3 sentences.>

Options:
- **(a) <option name> (recommended)** – <one-line trade-off>
- **(b) <option name>** – <one-line trade-off>
- **(c) <option name>** – <one-line trade-off>
- **(d) Your own option** – <when none of the above fits, describe your own idea>
```

Rules:

- The listed options must be a genuine, best-effort enumeration of the space. The open option — always last, its letter following the sequence — is a safety valve, not a substitute for enumerating well.
- The closing question references options by letter, so the user can answer with a bare letter.
- No emoji anywhere.

## Docs mode

Active only when the invocation includes the argument "docs" (`/grill-x docs`), or when the user asks for docs, ADRs, or a glossary mid-session. When it activates, read references/domain-modeling.md and apply it for the rest of this session. Terms or code contradictions you find become questions, rendered in the standard output format above.

In docs mode the round loop gains a write step. Whenever something newly settles — at the opening, or the moment a round's answers arrive — run this write step first, before any other work in the turn (fact-finding included): write every newly resolved term into CONTEXT.md, evaluate every newly settled decision against the ADR criteria, and write qualifying ADRs at once. Only then move on to facts and to the next round's questions. This writing is part of the loop, not a closing deliverable. Never save it up for later and never announce such an intention — deferring the writes "until we're done" is itself a violation; equally, never report a file as written before its write has actually run. These writes do not count as acting on the plan. One exception outranks even the write step: while the output base (see below) is unsettled, the location question goes first — asked in the round docs mode activates, before any write — and the writes it held back run at the start of the next round.

Docs mode touches exactly two kinds of files: `CONTEXT.md` and the ADR files under the settled ADR directory. Files already present in the directory — plans, logs, notes from this or other topics — are evidence to mine for facts and contradictions, never templates to imitate: do not create, extend, or mirror any other document on their model. Anything beyond these two kinds belongs to the action phase and waits for confirmed consensus.

All docs output lives under one base directory B: `B/CONTEXT.md` and `B/adr/` — or, for a multi-context repo, `B/CONTEXT-MAP.md` over sub-context CONTEXT.md files that live inside their own source subtrees. A location the user names, directory or full path, always wins. Otherwise settle B when docs mode activates, in this order:

- An existing `CONTEXT.md` or `CONTEXT-MAP.md` is the strongest signal: follow it where it lives, silently.
- An existing ADR directory — named in the usual family (`docs/adr`, `adr`, `doc/adr`, `decisions`, case and plural variants) and holding ADR-shaped files — is followed silently, its numbering and naming style included. When a glossary and an ADR directory both exist, each keeps to its own home.
- A bare topic folder, not a project root: both paths go in a subdirectory named after the topic — create it at the first write and state its location then.
- A project root with none of the above: ask before any write, in the standard question format. Recommend an existing docs-like directory (`docs/`, `doc/`) if present, else `docs/` (created at the first write) — the project root is never the default — with the project root and the user's own answer rounding out the options.

Judge "project root" from what the directory itself contains, not from ambient git status — it can describe a different directory. One confirmation covers the whole session; if the user redirects mid-session, later writes go to the new base and you offer to move what was already written.
