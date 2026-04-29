# Codex Dev Team

A Codex-native software development team framework.

This project ports the core ideas from role-based agent development
frameworks into primitives that fit Codex: `AGENTS.md`, reusable skills,
repo-local scripts, JSON gates, Git/worktree-friendly workflows, and
local/cloud execution profiles.

## What It Provides

- A structured 9-stage delivery pipeline
- Codex skills for pipeline, implementation, review, and audit workflows
- Deterministic JSON gates validated by `scripts/gate-validator.js`
- Bootstrap installation into target projects
- Role definitions for PM, Principal, Backend, Frontend, Platform, QA, and Security
- CI-ready tests with no runtime dependencies
- Version and contract drift tests from the start

## Quick Start

```bash
npm test
npm run lint
bash bootstrap.sh /path/to/target-project
```

Then open the target project in Codex and use the installed skills:

- `pipeline: build <feature>`
- `implement <item>`
- `pre-pr-review`
- `audit <scope>`

## Design Principles

1. Codex-native, not Claude-compatible-by-accident.
2. Deterministic state beats prose-only status.
3. Every workflow is usable locally and portable to cloud delegation.
4. Git history and PR review are first-class outputs.
5. Tests guard the framework contracts, not just JavaScript syntax.

## Repository Layout

```text
.codex/
  config.yml
  rules/
  skills/
schemas/
scripts/
tests/
pipeline/
```

## Status

`v0.1.0` is the initial scaffold. It is intentionally small but already
executable: bootstrap, gate validation, status, roadmap, skills, and tests.
