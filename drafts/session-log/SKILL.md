---
name: session-log
description: Parse any coding agent's recorded session log — session overview, readable dialogue, human prompts, tool-call table, token usage, single-entry JSON, regex search — and let a new session selectively consume an old session's history without importing it wholesale. Use when analyzing, evaluating, or searching a past coding-agent session (e.g. reviewing how a skill behaved in a test round), or when continuing an old session in a new one.
---

# session-log

A dispatcher: this file holds no parsing logic. It decides which coding agent's session log is wanted, then drives that agent's backend script in `scripts/`. One backend per agent; today that is claude-code. Adding an agent later = one new script + one new entry under "Backends" — nothing else changes.

## Dispatch

Pick the backend, in this order:

1. The user names the agent — see each backend's aliases.
2. The session log's storage path matches a backend's location pattern.
3. The file head matches a backend's schema (Read the first lines yourself).
4. Nothing matches or still ambiguous — ask, and list the supported agents.

One backend and one session log per invocation. Never write anything into an agent's session-store directory.

## Command surface — identical for every backend

`<invocation> <command> <locator> [options]` (zero-dependency Node ≥ 18 unless the entry says otherwise). Seven commands; a command whose data the agent never records prints `not recorded by <agent>` (with `--json`: `null` + `note`) instead of being absent:

- `summary` — one-screen session shape: time range, entry counts, prompts/messages, tool histogram with errors, token totals per model, title.
- `transcript` — the conversation: user text verbatim, assistant text verbatim, `→ tool brief-input` / `← result-size | ERROR msg` lines. `--no-tools` for pure dialogue.
- `user` — real human prompts only; harness-generated ones tagged.
- `tools` — every tool call: event idx, time, name, brief input, result bytes or error text.
- `usage` — per-assistant-message token counts plus totals.
- `get <ref>` — full JSON of one entry. Event idx is the only ref form every backend guarantees.
- `grep <pattern>` — regex across user/assistant text and tool inputs/results, one line per matching event, the match wrapped in `⟦⟧`. `-i` for case-insensitive.

Common options: `--json` (NDJSON per record; `summary` emits one object), `--max-len <n>` (preview truncation across `user`/`tools`/`transcript`; per-view defaults 100/120/240 when unset), `-i`. Event `#idx` is the stable ordinal within that session log; every command shows the same numbering, so an idx seen anywhere works as a `get` ref.

## Backends

### claude-code

- Invocation: `node scripts/claude-code.mjs <command> <file> [options]`
- Locator: path of one session file.
- Stored at `~/.claude/projects/<munged-cwd>/<session-id>.jsonl` (Windows: `%USERPROFILE%\.claude\projects\...`). To find a session, list that directory yourself (newest first), then confirm with the user.
- Recognized by: the path pattern above, or a file head of JSON lines carrying `"type":"user"|"assistant"|"summary"`, `message.id`, `sessionId`, `cwd`.
- Aliases: claude code, claude-code, claude, cc.
- Extras beyond the surface: `--sidechain` (subagent entries, hidden by default), `--thinking`, `--only <roles>`, `--full`; `get` also accepts `L<line>` and uuid prefix; grep also searches @-mentioned attachment bodies and compact-summary text; result sizes are UTF-8 bytes.
- Format notes: assistant turns arrive as several jsonl lines sharing one `message.id` — merged into one message; every `tool_use` block is paired with its `tool_result`; bookkeeping entries (`mode`, `ai-title`, `file-history-snapshot`, …) are skipped; `type:"summary"` entries (compaction summaries, session-continuation chains) appear as `[compact-summary]` events, and `summary` reports their leaf uuids.

## Evaluation flow — analyzing a recorded session

1. `summary` — how big, how many turns, which tools, what cost.
2. `user` — what the human actually asked, and where they intervened.
3. `transcript --no-tools` — the dialogue itself; add `--thinking` if the reasoning matters.
4. `tools` / `usage` — behavioral fingerprint (what it read/wrote/asked) and token spend.
5. `grep <term>` — every place the term surfaced: prompts, attachments, tool I/O.

## Import flow — continuing an old session in a new one

Never feed a whole session log into context: a session big enough to have been compacted will compact the importer too. Treat the parse as a random-access store and pull layers on demand:

1. Run `summary` and read it — it is small. If it reports compact summaries, `get <idx>` those events early: a compact summary is the densest form of the compacted past.
2. Redirect the slice you need to a file:
   `node scripts/claude-code.mjs transcript --no-tools <session>.jsonl > <target>`
   Default `<target>`: `<project-root>/session-logs/<uuid8>-<view>.md` — project root is the git toplevel of the consuming session's cwd (the cwd itself when not a repo); create the dir if missing. A directory the user names wins for that session only — remembered in conversation, no persisted state. A temp file is fine only for scratch the user will never reference. When you first create `session-logs/`, suggest adding it to .gitignore: derivatives are regenerable from the source log.
3. The consuming session then Reads/Greps that file with offset/limit — only the needed window enters its context. `user`, `tools`, `usage`, `grep` produce the other slices the same way.
4. For stdout, pipe through `tail` / `head` / `wc -l` instead of reading everything.

The session log itself (`.jsonl`) stays the complete record; parsed files are disposable derivatives.
