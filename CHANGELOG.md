# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `.claude/settings.json`: allow rules for `node scripts/workitem.mjs`,
  `scripts/check.mjs`, and `scripts/link-skill.mjs`; `gh` stays reachable only
  through the scripts.
- `.gitattributes` pins LF line endings for the `session-log` test fixtures and
  goldens, so Windows' `core.autocrlf` cannot change the summary byte counts.
- Work-item automation (`scripts/workitem.mjs`): `plan save` creates
  `.worktree/<skill>/<topic>` and branch `<skill>/<topic>` from `main`, writes
  the stdin-or-existing `_dev/plan.md`, makes one empty commit, pushes, and
  creates or updates the draft PR body; `uat save` appends a section to
  `_dev/test-log.md` and posts the identical section as a PR comment, deduped
  by section hash; `--final` records approval/waiver; `sync` retries pending
  remote writes; `status` prints branch/worktree/PR/pending. Local-first: a gh
  failure leaves `_dev/sync.json` pending and exits 0 with a warning. Never
  commits `_dev`, never force-pushes, never reuses a branch.
- Work-item integration tests (`scripts/tests/`): `run.mjs` builds a temporary
  bare repo + clone and drives `workitem.mjs` through `fake-gh.mjs`, covering
  create/update idempotency, UAT log+comment, duplicate suppression, pending
  retry through `sync`, status, error paths, and the no-tracked-`_dev`
  invariant. Discovered and run by `scripts/check.mjs`.
- UAT link helper (`scripts/link-skill.mjs`): `status` lists each
  `.claude/skills` link and whether its target exists; `<skill> main` points a
  link at the main worktree's `skills/<skill>`; `<skill> <worktree-path>` points
  it at that worktree's copy. Replacing removes only the link itself (Windows
  junction, POSIX symlink) and refuses real directories/files. `remove <skill>`
  deletes only the link and is idempotent — run it before `git worktree remove`,
  because recursive deletion can follow a junction into the main checkout.
  `--link-dir` targets a worktree or sandbox, so the main checkout's links stay
  on `main`. The repo is resolved from the script's own checkout, so the
  command also works from a sandbox cwd that is not a git repository.
- Deterministic gate 1 (`scripts/check.mjs` + `.github/workflows/ci.yml`):
  one zero-dependency command checks repo invariants (CLAUDE.md pointer, no
  tracked `skills/**/_dev` or `_sources`, kebab-case skill dirs), skill
  structure (frontmatter name/description, resolvable relative links,
  non-empty `references/`), `node --check` for every `.mjs`, and every
  discovered fixture runner; GitHub Actions runs it on pull requests and
  pushes to `main`. `--skill <name>` narrows the skill checks. A CHANGELOG
  soft check only warns in Actions, never fails.
- `session-log` fixture suite (`skills/session-log/tests/`): synthetic
  `minimal.jsonl` (multi-turn dialogue, merged assistant blocks, paired
  tool_use/tool_result, command and meta entries) with hand-inspected goldens
  for summary/transcript/user/tools/usage/get, plus flag, JSON, current-turn
  trimming, export determinism, error-path, and repeatability tests. Discovered
  and run by `scripts/check.mjs`.
- `session-log` stable export bundle (`skills/session-log/scripts/export.mjs`):
  one dispatcher-level command writes the canonical five views — summary,
  transcript (dialogue plus command lines, no tool lines or skill bodies),
  user, tools, usage — as `<uuid8>-<view>.md` into a user-named directory
  (default `<project-root>/session-logs/`), so the same parse request no longer
  yields two or five files depending on the agent's discretion. `--views`
  narrows the bundle; `--include-current` passes through to every view.
- `session-log` current-invocation exclusion: parses of the current session cut
  the trailing turn — command or prompt, skill body, and backend calls — by
  default, suffix-trimmed so retained event indexes and `L` line references
  still match the raw log; earlier turns and earlier `session-log` invocations
  remain. Applies to all seven commands; `--include-current` restores the full
  log. Explicit-path targets are trimmed only when the path matches an
  env-backed current-session resolution (the env-less newest-file heuristic
  fails open).
- `session-log` flags: `--include-current` (common), and `--no-cmd` for
  transcript (hide `[cmd]` command entries).
- `session-log` claude-code backend: `current` locator — resolve the invoking
  session's log with no manual path (`$CLAUDE_CODE_SESSION_ID` →
  `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<munged-cwd>/<id>.jsonl`), with a
  freshness cross-check for the stale-id edge after `--continue`/`--resume`, an
  id search across project dirs when the derived path is missing, and a
  newest-file heuristic when the env var is absent; resolution notes go to
  stderr so stdout stays parseable. Parked, not applied: the env-less heuristic
  has no freshness guard (it resolved a 7-day-old file in a foreign project dir,
  labeled as heuristic — a possible mtime threshold or confirmation step), and
  the failure candidate table can put unrelated concurrent sessions first, so
  consumers should confirm with the user rather than take the top hit.
- Graduated-skill iteration procedure (in `AGENTS.md`): iterate in place inside
  `skills/<name>/`; `_dev/` (and `_sources/`) there are gitignored, permanent
  local working dirs — never committed, never deleted. Two-stage gate for
  behavior changes (doc-only fixes commit directly): scripted verification
  recorded in `_dev/test-log.md` gates the content commit; closing an iteration
  needs at least one real-project use recorded there plus user approval
  (explicit waiver when none is forthcoming). With `_dev/` out of version
  control, CHANGELOG is the only durable record — entries must absorb every
  conclusion and "Parked, not applied" finding. Close is a test-log closing
  entry (plan marked superseded), not a commit; iteration branches decouple
  from `_dev/` (one iteration may span several), and same-skill iterations run
  serially, with validation-window fixes landing as further content commits in
  the same iteration.
- Graduation procedure (in `AGENTS.md`): codified from the grill-x and session-log
  graduations — commit pending test-log changes first; one graduation commit moves
  runtime files verbatim (100% rename), drops `_`-prefixed dirs wholesale, and records
  the CHANGELOG entry plus any parked findings.
- `session-log` skill (in `skills/session-log/`): parse any coding agent's recorded
  session log — `summary` / `transcript` / `user` / `tools` / `usage` / `get` / `grep`
  over an identical per-backend command surface (claude-code backend today) — with an
  evaluation flow for analyzing a recorded session and a random-access import flow for
  continuing an old session in a new one. Graduated from `drafts/session-log` after the
  T6 real-evaluation dogfood (2026-10-20, flashcard-extract first test: byte-identical
  reruns, idx alignment, cross-checked token totals); `_dev/` dropped per the `drafts/`
  convention.

- `grill-x` skill (in `skills/grill-x/`): a relentless design-tree interview to sharpen
  a plan or decision, with an optional `docs` mode that turns resolved terms into
  CONTEXT.md and ADRs. Graduated from `drafts/grill-x` after T8 (criteria 1–6 all
  passed; criterion 7 withdrawn as a gate on 2026-10-19); `_dev/` and `_sources/`
  dropped per the `drafts/` convention.

- `_`-prefix rule for `drafts/` (in `AGENTS.md`): underscore-prefixed directories are
  dev-time only and dropped wholesale on graduation to `skills/`; dev-time files always
  live inside a `_` directory, never bare at the skill root. New optional `_dev/`
  folder (`plan.md` + `test-log.md`) alongside `_sources/`.
- `drafts/` staging area convention (in `AGENTS.md`): skills under development live in
  `drafts/` with the same layout as `skills/`, and may carry a `_sources/` folder of
  dev-time source material that stays behind on graduation to `skills/`.
- Repository scaffold: `AGENTS.md` as the single source of agent instructions
  (`CLAUDE.md` is a one-line `@AGENTS.md` pointer, guarded by `.githooks/pre-commit`),
  `skills/` layout, and `.editorconfig`.

### Changed

- `AGENTS.md` iteration flow replaced with GitHub Flow + staging/UAT: one work
  item = one branch = one PR; gate 1 (CI) and gate 2 (UAT) before a rebase
  merge; PR body/comments plus `CHANGELOG.md` as the durable records; worktree
  `_dev/` as a per-branch working copy; declared UAT venue and link switching;
  `workitem` automation triggers; one open branch per skill; and link removal
  before worktree deletion (Windows junction safety).
- `.gitignore` also ignores `session-logs/`, the default output directory of
  `session-log export` (regenerable derivatives, never source).
- `AGENTS.md` dedupe (docs-only, no behavior change): `_`/`_dev/` deposit
  semantics now live only in the directory tree; the CHANGELOG obligation is
  stated once under 「约定」; the graduation commit's `feat/<name>` branch,
  Conventional Commits, and the docs/small-fix path are now explicit. Dropped
  the speculative `skills/`-side `_sources/` mention and the empty-directory
  cleanup step; `.gitignore` now points at `AGENTS.md` for the `_dev/`
  rationale.
- `session-log` `--no-meta` now hides only harness-injected `[meta]` skill
  bodies; command entries stay in the transcript. Add `--no-cmd` to hide those
  as well. This keeps a transcript's opening slash-command request readable
  while dropping the duplicated skill text.
- Parked, not applied (session-log parse-stability): invocation-boundary
  detection matches `claude-code.mjs` or `export.mjs` in the recorded Bash
  command, then walks back to the nearest ordinary user entry; if a future
  dispatch routes through an opaque wrapper name, detection falls back to the
  last ordinary user entry and fails open (extra content, never over-trimming).
  A session whose only turn is the current invocation exports an empty view by
  design.
- Parked, not applied (session-log T6 finding): a human's structured decisions
  (AskUserQuestion answers) are recorded only in the `tool_result`, so they are invisible
  to `user` / `transcript --no-tools` / `tools`; today the `grep` step and the assistant's
  next-message restatement cover it. Recorded here so it survives the `_dev/` drop — on
  first real-world miss, add one sentence to the claude-code Format notes in `SKILL.md`.
- `grill-x` post-graduation trim (2026-10-19): dropped the in-file version comments from
  `SKILL.md` (this changelog is the version record now); deduplicated `references/` —
  the ADR criteria survive in `ADR-FORMAT.md`, the single/multi-context layout in
  `CONTEXT-FORMAT.md`, and `domain-modeling.md` points to both; legalized burned question
  numbers in the output format (a drafted question demoted to a default skips its number;
  the gap stays vacant); dropped the stale source-skill enumeration from the
  self-contained note (those skills are no longer installed).
- Parked, not applied: the one-line action-gate definition for the T9 known boundary
  behavior, recorded here so it survives the `_dev/` drop — apply on first real-world
  encounter: "Confirmation is a reply to a restated consensus. An instruction to act
  received before any consensus has been restated triggers the closing procedure —
  restate the recommendations you would adopt and wait one reply — not the action phase.

### Removed

- Root `CONTEXT.md` and `docs/adr/` — artifacts produced by grill-x docs mode
  while developing `session-log`, not repository conventions. Removed from
  `main`; the grill-x docs-mode behavior is treated as a skill defect."
