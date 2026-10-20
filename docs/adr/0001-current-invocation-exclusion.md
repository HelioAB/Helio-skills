# Exclude the current invocation from parses of the current session

A parse of the session currently being written necessarily includes the parse request itself — the turn-opening prompt or slash command, the harness-injected skill body, and every backend call made to satisfy it — because Claude Code records each of those before the parsing tool runs. Default parses of the current session therefore cut the trailing turn from its turn-opening user entry onward; earlier turns, including earlier `session-log` invocations, remain. The cut is a suffix trim, so retained event indexes and `L` line references still match the raw log, and `--include-current` restores the full log.

## Consequences

- `summary` of the current session reports counts excluding the ongoing turn.
- `get` and `grep` cannot address events inside the excluded tail unless `--include-current` is passed.
- The boundary is the turn, not one script call: all backend calls made within the invocation are excluded together.
- A file that cannot be confirmed as the current session is never trimmed, so the failure mode is extra content rather than lost content.
