---
name: audit
description: "Audit a codebase and produce architecture, health, security, performance, quality, backlog, and roadmap outputs under docs/audit/."
---

# Audit Skill

Use this when the user asks to analyze a codebase, generate a roadmap, or run
a health check.

## Phase Definitions

The authoritative phase definitions (inputs, outputs, checkpoints, resume
semantics) live in `.codex/references/audit-phases.md`. Read that file at the
start of every audit run. The summary below is for orientation only.

## Phases

1. Project context and architecture map
2. Test, documentation, and compliance health
3. Security, performance, and code quality review
4. Backlog and sequenced roadmap

## Outputs

Scaffold the expected audit workspace before collecting evidence:

```bash
npm run audit -- "<scope>"
npm run audit:quick -- "<scope>"
npm run health-check
```

Write:

- `docs/audit/00-project-context.md`
- `docs/audit/01-architecture.md`
- `docs/audit/04-tests.md`
- `docs/audit/06-security.md`
- `docs/audit/08-code-quality.md`
- `docs/audit/09-backlog.md`
- `docs/audit/10-roadmap.md`
- `docs/audit/status.json`

Use concrete evidence and exact verification commands.

Read `pipeline/lessons-learned.md` when present so recurring issues from prior
runs influence the backlog and roadmap.

## Roadmap Shape

`docs/audit/10-roadmap.md` should group work into:

- immediate fixes
- targeted improvements
- strategic investments
- parked/platform-blocked items

Every item should include impact, effort, risk, verification, and likely file
areas. Mark completed items with `[DONE]` so `npm run roadmap` can summarize
progress.
