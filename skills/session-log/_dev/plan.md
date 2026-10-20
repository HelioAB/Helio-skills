# session-log / parse stability

## Goal

Fix two defects in the session-log skill:

1. Parsing the current session includes the current `/session-log` invocation — its command, skill body, and backend calls. Default parses must cut that trailing turn while keeping earlier invocations.
2. The same parse-and-output request produced five, five, or two files across sessions. The bundle must be deterministic.

## Decisions

See `CONTEXT.md` and ADRs 0001–0002. In brief:

- Current invocation = trailing turn from its turn-opening user entry; suffix trim, current session only, all commands, `--include-current` opt-out.
- Canonical bundle = `summary`, `transcript` (`--no-tools --no-meta`), `user`, `tools`, `usage`, written by a dispatcher-level `scripts/export.mjs`; backends stay seven print-only commands.
- `--no-meta` now hides only `[meta]` skill bodies; new `--no-cmd` hides command entries.

## Implementation

1. `scripts/claude-code.mjs`: quiet current resolution, explicit-path current detection (fail open), invocation-boundary detection, shared `loadView`, flag changes.
2. `scripts/export.mjs`: new wrapper — backend map, five views, `<out>/<uuid8>-<view>.md`, `--out`/`--views` defaults, `--include-current` pass-through.
3. `SKILL.md`: document the exclusion, new flags, and export flow.
4. `CHANGELOG.md`: Added/Changed entries plus parked findings.

## Verification

Fixtures: the three sandbox session logs. Fake current-session root via `CLAUDE_CONFIG_DIR` + `CLAUDE_CODE_SESSION_ID`. Check:

- default trim ends before the invocation; `--include-current` restores it;
- earlier `/flashcard-extract` command remains; `[meta]` bodies hidden, `[cmd]` kept;
- an explicit past-session path is never trimmed;
- two exports produce identical file sets and content;
- a fresh session whose only turn is the invocation exports an empty view without crashing;
- a user entry queued after the script call does not move the boundary.

Conclusions recorded in `test-log.md`.
