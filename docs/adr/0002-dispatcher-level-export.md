# Export bundles from a dispatcher-level wrapper

The backend scripts stay print-only with their seven-command surface; a dispatcher-level `export.mjs` runs the chosen backend's five views and writes the canonical bundle. This keeps the skill's "one backend per agent, one script" contract: a new backend implements parsing only and inherits a stable export. The trade-off is a second runtime script plus a small per-backend view-flag map; the rejected alternative, an eighth `export` command in every backend, would duplicate orchestration and widen the contract for every future agent.

## Consequences

- `SKILL.md` has one deterministic execution path for parse-and-output requests.
- Output-directory, overwrite, and file-naming policy live in the dispatcher, not in backends.
