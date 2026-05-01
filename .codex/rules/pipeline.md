# Pipeline

The Codex Dev Team pipeline is a deterministic delivery workflow. It can run
locally, in a Codex app worktree, or as delegated cloud tasks.

## Stage 0 - Routing and Budget

Before Stage 1, the orchestrator decides which track to run and (optionally)
initialises budget tracking.

### Safety stoplist

The full track is mandatory for any change that touches:
- Authentication, authorization, or session handling
- Cryptography, key management, or secrets rotation
- PII, payments, or regulated-data handling
- Schema migrations or destructive data changes
- Feature-flag introduction (toggling existing flags is fine in config-only)
- New external dependencies (upgrades are fine in dep-update)

The lighter tracks (quick, nano, config-only, dep-update) must not be used
to bypass this list. When uncertain, default to full.

### Budget gate (opt-in)

If `.codex/config.yml` has `budget.enabled: true`, the orchestrator writes
`pipeline/budget.md` at run start with zero counters and updates it at every
stage boundary. On exceed:
- `on_exceed: escalate` writes `pipeline/gates/stage-budget.json` with
  `status: ESCALATE` and halts the pipeline.
- `on_exceed: warn` logs the breach and continues.

Token counts are best-effort.

### Async-friendly checkpoints

By default the pipeline halts at Checkpoints A (after requirements), B
(after design), C (after QA). When `.codex/config.yml` sets
`checkpoints.<a|b|c>.auto_pass_when`, the orchestrator auto-passes that
checkpoint when the named condition holds. Never auto-pass a security-
sensitive run — the stoplist above remains the hard guard.

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

## Track Contracts

`npm run next` is track-aware. It infers the active track from
`CODEX_TEAM_TRACK`, existing gate files, or `pipeline/context.md`, then advances
only through the stages that track uses.

### full

Full track uses every stage in order. Stage 6 normally uses matrix review, but
pre-existing scoped gates remain valid when a run intentionally narrows review
area and approval count.

### quick

Quick track uses Requirements -> Build -> Peer Review -> QA -> Deploy ->
Retrospective. Stage 6 review gates must be scoped reviews with
`required_approvals: 1`. `npm run pipeline:review` precreates quick scoped
review gates from existing `pipeline/pr-<area>.md` files.

### nano

Nano track uses Build -> QA only. It must not write requirement, design,
clarification, pre-review, deploy, or retrospective gates. A PASS QA gate must
record `regression_check: "PASS"`.

### config-only

Config-only track uses Build -> Pre-review -> QA -> Deploy. It records
`CONFIG-ONLY scope` in `pipeline/context.md`. A PASS QA gate must record
`regression_check: "PASS"`.

### dep-update

Dependency-update track uses Build -> Peer Review -> QA -> Deploy. The review
area is `deps`, with a precreated `pipeline/gates/stage-06-deps.json` scoped
review gate requiring one approval. A PASS QA gate must record
`regression_check: "PASS"`.

### hotfix

Hotfix track uses Build -> Pre-review -> Peer Review -> QA -> Deploy ->
Retrospective. It writes `pipeline/hotfix-spec.md`, records
`STAGE-4.5A-SKIP: hotfix track`, and still runs the conditional security check.
A PASS Stage 5 gate must record `stage_4_5a_skipped: true`.

## Helper Commands

- `npm run quick -- "<change>"` starts a quick-track run and stamps quick gates.
- `npm run nano -- "<change>"` records a nano scope and starts the edit stage.
- `npm run config-only -- "<change>"` records config-only scope and starts platform edit.
- `npm run dep-update -- "<update>"` records dependency scope and starts platform edit.
- `npm run hotfix -- "<bug and fix>"` writes `pipeline/hotfix-spec.md` and starts build.
- `npm run review:derive` derives Stage 6 approval gates from review files.
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
