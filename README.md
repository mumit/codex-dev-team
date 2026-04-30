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
- Status dashboard for gates, key artifacts, and audit state
- Stage 5 approval derivation from review files
- Security-trigger and runbook helper checks
- Bootstrap installation into target projects
- Pluggable Stage 8 deployment adapters for Docker Compose, Kubernetes, Terraform, and custom scripts
- Role definitions for PM, Principal, Backend, Frontend, Platform, QA, and Security
- CI-ready tests with no runtime dependencies
- Version and contract drift tests from the start

## Quick Start

```bash
npm test
npm run help
npm run lint
npm run doctor
bash bootstrap.sh /path/to/target-project
```

Bootstrap preserves the host project's identity. If the target already has a
`package.json`, missing npm command shims are added without overwriting existing
scripts. If the target is not a Node project, no `package.json` is created; use
the installed CLI directly:

```bash
node scripts/codex-team.js help
node scripts/codex-team.js status
node scripts/codex-team.js pipeline "Add authentication"
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
examples/
```

## Status

`v0.2.0` adds stage-specific gate schemas, the `codex-team` CLI, CI, richer
skills, and dogfood install coverage. It is still local-only by design until
you decide to publish a remote.

## CLI

```bash
npm run doctor
npm run gate:check
npm run gate:check:all
npm run pipeline:check
npm run validate
npm run release:check
npm run release:notes
npm run pr:pack
npm run status
npm run status -- --json
npm run next
npm run next -- --json
npm run summary
npm run roadmap
npm run roadmap -- --json
npm run audit -- "src/backend"
npm run audit:quick -- "src/frontend"
npm run health-check
npm run reset
npm run pipeline -- "Add authentication"
npm run pipeline:scaffold -- "Add authentication"
npm run pipeline:new -- "Add authentication"
npm run pipeline:brief -- "Add authentication"
npm run design -- "Add authentication"
npm run pipeline:review
npm run pipeline:context
npm run retrospective
npm run role -- pm
npm run prompt -- requirements "Add authentication"
npm run stage -- requirements
npm run stage -- design
npm run stage -- clarification
npm run stage -- build
npm run stage -- pre-review
npm run stage -- peer-review
npm run stage -- qa
npm run review:derive
npm run security:check -- src/backend/auth/session.js
npm run runbook:check
npm run lessons -- show
npm run lessons -- promote
```

Set `CODEX_TEAM_TRACK=quick` (or another supported gate track) before stage or
prompt commands to stamp that track into generated gates.

## Deployment Adapters

Stage 8 reads `.codex/config.yml` and `.codex/adapters/<adapter>.md`. The
default adapter is `docker-compose`; built-in alternatives are `kubernetes`,
`terraform`, and `custom`. Adapters are documented procedures, not hidden
executors: the Platform role follows the selected adapter, writes
`pipeline/deploy-log.md`, and advances `pipeline/gates/stage-08.json`.
