# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `drafts/` staging area convention (in `AGENTS.md`): skills under development live in
  `drafts/` with the same layout as `skills/`, and may carry a `_sources/` folder of
  dev-time source material that stays behind on graduation to `skills/`.
- Repository scaffold: `AGENTS.md` as the single source of agent instructions
  (`CLAUDE.md` is a one-line `@AGENTS.md` pointer, guarded by `.githooks/pre-commit`),
  `skills/` layout, and `.editorconfig`.
