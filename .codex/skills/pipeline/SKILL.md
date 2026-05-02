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
5. Read `pipeline/lessons-learned.md` if present and apply relevant lessons.
6. Determine the track: `full`, `quick`, `nano`, `config-only`,
   `dep-update`, or `hotfix`.

Initialize the workspace when starting a new run:

```bash
npm run pipeline -- "<feature name>"
```

Use the lower-level initializer only when you need an empty runtime workspace:

```bash
npm run pipeline:new -- "<feature name>"
```

To prepare every stage artifact and draft gate up front:

```bash
npm run pipeline:scaffold -- "<feature name>"
```

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

Generate the standard prompt shape with:

```bash
npm run prompt -- requirements "<feature name>"
npm run role -- pm
```

Write gates under `pipeline/gates/` and run:

```bash
npm run gate:check
npm run gate:check:all
```

To scaffold common stage artifacts:

```bash
npm run pipeline:brief -- "<feature name>"
npm run design -- "<feature name>"
npm run pipeline:review
npm run pipeline:context
npm run retrospective
npm run stage -- requirements
npm run stage -- design
npm run stage -- clarification
npm run stage -- build
npm run stage -- pre-review
npm run stage -- peer-review
npm run stage -- qa
npm run stage -- deploy
npm run stage -- retrospective
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

Generate a durable run summary with:

```bash
npm run summary
```

If the retrospective contains durable learning, write lines beginning with
`LESSON:` in `pipeline/retrospective.md`, then run:

```bash
npm run lessons -- promote
```

To visualize the final pipeline state:

```bash
npm run visualize
```

If budget tracking is enabled (`budget.enabled: true` in `.codex/config.yml`),
check running totals at any time with:

```bash
npm run budget -- check
```

## Stage Gates

High-value stages have schema-backed required fields:

- Stage 1: requirements completeness and acceptance criteria count
- Stage 2: architecture and PM approval
- Stage 3: clarification closure and scope changes
- Stage 4: build workstreams and local verification
- Stage 5: pre-review checks and security trigger
- Stage 6: review approvals and changes requested
- Stage 7: QA result and acceptance mapping
- Stage 8: sign-off, deploy intent, and runbook reference
- Stage 9: retrospective severity and promoted lessons
