# AGENTS.md

Project instructions for Codex when working in a repository that has
installed `codex-dev-team`.

## Codex Dev Team Roles

The framework simulates a small product engineering team. Roles are prompt
modules, not separate hidden assistants. A Codex task should explicitly name
the role it is performing and write its outputs to the pipeline files listed
below.

| Role | Owns | Writes |
|---|---|---|
| PM | Requirements, acceptance criteria, sign-off | `pipeline/brief.md`, Stage 1/7 gates |
| Principal | Architecture, ADRs, review chair | `pipeline/design-spec.md`, `pipeline/adr/` |
| Backend | APIs, services, data | `src/backend/`, backend PR notes |
| Frontend | UI, client logic | `src/frontend/`, frontend PR notes |
| Platform | CI, infra, deploy | `src/infra/`, deploy/runbook outputs |
| QA | Tests and acceptance mapping | `src/tests/`, `pipeline/test-report.md` |
| Security | Conditional security review | `pipeline/security-review.md`, security gate |

## Core Rules

- Read `.codex/rules/pipeline.md` before running a pipeline stage.
- Read `.codex/rules/gates.md` before writing a gate.
- Read `pipeline/lessons-learned.md` before substantial planning.
- Use JSON gates as the source of truth; do not infer stage status from prose.
- Keep `pipeline/context.md` append-only during a run.
- Keep changes scoped to the role's ownership unless the user approves a wider change.
- Run `npm test` and `npm run lint` before committing framework changes.

## Command Shims

Use these local npm scripts when a user asks for the matching command-style workflow:

| User intent | Local command |
|---|---|
| `/pipeline <feature>` | `npm run pipeline -- "<feature>"` |
| `/pipeline-brief <feature>` | `npm run pipeline:brief -- "<feature>"` |
| `/design <feature>` | `npm run design -- "<feature>"` |
| `/pipeline-review` | `npm run pipeline:review` |
| `/pipeline-context` | `npm run pipeline:context` |
| `/retrospective` | `npm run retrospective` |
| Stage task prompt | `npm run prompt -- <stage> "<feature>"` |
| `/stage <name>` | `npm run stage -- <name>` |
| `/status` | `npm run status` |
| `/roadmap` | `npm run roadmap` |
| `/audit [scope]` | `npm run audit -- "<scope>"` |
| `/audit-quick [scope]` | `npm run audit:quick -- "<scope>"` |
| `/health-check` | `npm run health-check` |

## Local vs Cloud

Tasks must be self-contained enough to run in Codex local, Codex app worktrees,
or delegated cloud sandboxes. Include the current stage, files to read, expected
outputs, and verification commands in every long-running task prompt.

## Git

Prefer branch names beginning with `codex/` when the Git host supports nested
branch refs. Use a hyphenated fallback such as `codex-feature-name` when local
refs block nested names.
