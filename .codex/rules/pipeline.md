# Pipeline

The Codex Dev Team pipeline is a deterministic delivery workflow. It can run
locally, in a Codex app worktree, or as delegated cloud tasks.

## Tracks

| Track | Use for | Review |
|---|---|---|
| full | Cross-area features | Matrix review |
| quick | Small scoped code changes | One reviewer |
| nano | Trivial single-file edits | Regression check only |
| config-only | Configuration value changes | Platform review |
| dep-update | Dependency upgrades | QA + security-sensitive checks |
| hotfix | Urgent production bugs | Expedited review |

## Stages

1. **Requirements** - PM writes `pipeline/brief.md` and Stage 1 gate.
2. **Design** - Principal writes `pipeline/design-spec.md` and ADRs.
3. **Clarification** - unresolved questions in `pipeline/context.md` are answered.
4. **Build** - implementation happens in role-owned areas.
5. **Pre-review** - lint, type-check, dependency audit, and conditional security.
6. **Peer Review** - reviewers write `pipeline/code-review/by-<role>.md`.
7. **QA** - QA writes tests and `pipeline/test-report.md`.
8. **Sign-off and Deploy** - PM sign-off, then deployment when requested.
9. **Retrospective** - lessons are added to `pipeline/lessons-learned.md`.

## Helper Commands

- `npm run review:derive` derives Stage 5 approval gates from review files.
- `npm run security:check -- <changed files>` decides whether security review is required.
- `npm run runbook:check` verifies `pipeline/runbook.md` before deploy.
- `npm run validate` runs syntax checks and latest-gate validation.

## Codex Execution Model

For each substantial stage, write a self-contained task prompt:

- role
- stage
- files to read
- allowed write scope
- expected output files
- gate file to write
- verification command

This makes the same workflow usable in local Codex, Codex app worktrees, and
cloud delegation.

## Human Checkpoints

- Checkpoint A: after requirements
- Checkpoint B: after design
- Checkpoint C: after QA

Checkpoint bypass requires an explicit user instruction or a configured
auto-pass condition in `.codex/config.yml`.
