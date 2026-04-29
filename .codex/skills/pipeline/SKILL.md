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
