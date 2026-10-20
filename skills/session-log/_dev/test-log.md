# session-log / parse-stability — test log

Date: 2026-10-20. Fixtures: the three sandbox session logs under
`C:/Users/11440/.claude/projects/D--11--Deliverables--Sandbox-sandbox--005-flashcard-agent/`
(fce48d10, 030db440, 38465864), with a fake current-session root built from
`CLAUDE_CONFIG_DIR` + `CLAUDE_CODE_SESSION_ID`.

## T1 — default trim (fce48d10)

`transcript current` ends at `#64` (the last assistant message before the
invocation) and stderr says `current invocation excluded from L129`. The first
heading stays `#1 user [cmd]`; `--include-current` restores `#67` onward,
including the summary/export calls.

## T2 — flag semantics

`transcript current --no-meta` keeps `#1 user [cmd]` and hides `#2 user [meta]`
(footer: `1 meta entries hidden`). Adding `--no-cmd` also hides `#1`. Prior
command lines survive; skill bodies do not.

## T3 — current detection and fail-open

- explicit path equal to the env-resolved current file → trimmed;
- explicit path to a copy of the same log while the env id still names the
  original → not trimmed; tail includes `#67` onward;
- no env id, explicit path equal to the newest-file heuristic → not trimmed
  (fail open); `current` in the same condition still trims.

## T4 — export bundle (fce48d10 current)

`export.mjs claude-code current --out ...` writes exactly five files:
`fce48d10-summary.md`, `-transcript.md`, `-user.md`, `-tools.md`, `-usage.md`.
Transcript: 0 tool lines, 0 `[meta]` tags, 1 `[cmd]` tag, no `#67`; ends at
`#64`. Summary: `turns 3 user prompts (+2 command/meta) · 10 assistant messages`,
`tools 9 calls`, while the file line still reports the raw `166 lines` — counts
trimmed, file metadata raw. Two consecutive runs are byte-identical (`diff -r`
empty). `--views summary,transcript` writes exactly two files;
`--include-current` restores the invocation (`+4 command/meta`, 14 assistant
messages).

## T5 — boundary edge: queued user entry

Appended a plain user entry after the last script call. Default parse still
trims from L129 and the queued text does not appear; `--include-current` shows
it. The boundary anchor is the script call, not the last user entry.

## T6 — fresh session whose only turn is the invocation

Minimal fixture (command + meta + export tool call): `transcript current` is
empty (0 bytes); summary reports `0 user prompts · 0 assistant messages` and
still resolves the session id; `export.mjs` writes five `fresh000-*.md` files
with an empty transcript. No crash.

## T7 — real current session

`summary current` in the implementation session trims from L209, which parses
as `{"type":"user","content":"同意，立即执行"}` — the current task turn, not a
session-log call. `export.mjs current` writes five `c2af5433-*.md` files; the
transcript ends at `#122` and `同意，立即执行` is absent. Confirms the
generalized rule: any current-session parse excludes the ongoing turn.

## T8 — default output directory

From a fresh git repo, `export.mjs claude-code <past.jsonl> --views summary`
without `--out` writes `<repo>/session-logs/030db440-summary.md`.

## T9 — error paths

Unknown backend and unknown view exit non-zero with a supported-values message.
`get`/`grep` honor the trim and point at `--include-current` in their error or
no-match output.

## Result

All planned checks pass; no regressions observed in `summary`, `transcript`,
`user`, `tools`, `usage`, `get`, or `grep`. Known boundaries recorded in
CHANGELOG under "Parked, not applied": script-name-based boundary detection and
the empty export for a first-turn invocation.
