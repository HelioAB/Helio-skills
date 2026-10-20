# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- Graduated-skill iteration procedure (in `AGENTS.md`): iterating inside
  `skills/<name>/` may recreate `_`-prefixed dev dirs (`_dev/`, `_sources/`) in
  place; behavior changes need a `_dev/test-log.md` entry before they commit,
  doc-only changes commit directly, and iteration close distills conclusions
  into CHANGELOG (including "Parked, not applied" findings) then drops `_dev/`
  wholesale.
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
  restate the recommendations you would adopt and wait one reply — not the action phase."
