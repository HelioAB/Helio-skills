# session-log

A skill context: parsing coding-agent session logs into derived views, and consuming those views without importing the raw log wholesale.

## Language

**Session log**:
The raw agent-written `.jsonl` record of one session; the complete source of truth, never written to by this skill.

**Derived view**:
A single parsed rendering of a session log — `summary`, `transcript`, `user`, `tools`, `usage`, `get`, or `grep` — produced for one consumer and disposable.

**Current session**:
The session log that the invoking session is itself writing.

**Current invocation**:
The trailing user turn of the current session, beginning at its turn-opening user entry; default parses of the current session exclude it.

**Turn-opening user entry**:
The user entry that opens the current invocation; it is neither a meta entry nor a tool result, and may be a plain prompt or a slash-command entry.
_Avoid_: last real user prompt

**Export bundle**:
The fixed set of five derived views produced for a parse-and-output request: `summary`, `transcript`, `user`, `tools`, `usage`.

**Command entry**:
A user entry recorded for a slash command (`[cmd]`), carrying the command name and arguments; a human action, so transcripts keep it.
_Avoid_: command block

**Meta entry**:
A harness-injected skill body (`[meta]`), beginning "Base directory for this skill"; not human text, so transcripts hide it.
_Avoid_: skill definition
