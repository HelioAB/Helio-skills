# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
