---
name: pipeline
description: "Run the Codex Dev Team delivery pipeline for a feature. Use when the user asks to build a feature end-to-end, run the product workflow, or coordinate requirements, design, build, review, QA, deploy, and retrospective."
---

# Pipeline Skill

Use this skill to run the structured Codex Dev Team pipeline.

## Start

1. Read `AGENTS.md`.
2. Read `.codex/rules/pipeline.md`.
3. Read `.codex/rules/gates.md`.
4. Read `pipeline/context.md`.
5. Determine the track: `full`, `quick`, `nano`, `config-only`,
   `dep-update`, or `hotfix`.

## Execution

For each stage, create a self-contained Codex task prompt:

- role
- stage
- objective
- files to read
- allowed write scope
- expected artifacts
- gate file to write
- verification command

Template:

```text
Role: <PM | Principal | Backend | Frontend | Platform | QA | Security>
Stage: <stage number and name>
Track: <full | quick | nano | config-only | dep-update | hotfix>
Objective: <one sentence>
Read first:
- AGENTS.md
- .codex/rules/pipeline.md
- .codex/rules/gates.md
- pipeline/context.md
- <stage-specific files>
Allowed writes:
- <paths>
Expected artifacts:
- <files>
Gate:
- Write pipeline/gates/<stage>.json with required base fields and stage-specific fields.
Verification:
- <commands>
```

Write gates under `pipeline/gates/` and run:

```bash
npm run gate:check
```

## Human Checkpoints

Pause for user confirmation after requirements, design, and QA unless the
track explicitly skips that checkpoint.

## Finish

Run retrospective, update `pipeline/context.md`, and summarize:

- files changed
- gates written
- tests run
- open risks
- PR readiness

## Stage Gates

High-value stages have schema-backed required fields:

- Stage 1: requirements completeness and acceptance criteria count
- Stage 2: architecture and PM approval
- Stage 5: review approvals and changes requested
- Stage 7: QA result and acceptance mapping
- Stage 8: sign-off, deploy intent, and runbook reference
- Stage 9: retrospective severity and promoted lessons
