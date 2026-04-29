---
name: implement
description: "Plan, execute, verify, and commit a focused codebase improvement using Codex. Use for roadmap items, small enhancements, and clearly scoped fixes that do not need the full pipeline."
---

# Implement Skill

Use this for focused work that can be completed in one branch.

## Step 1: Understand

Read:

1. `AGENTS.md`
2. `docs/audit/10-roadmap.md` if present
3. `pipeline/context.md` if present
4. relevant source and tests

## Step 2: Plan

Before editing, present:

- context
- approach
- file-by-file changes
- tests
- verification commands
- rollback
- open questions

Proceed once the user approves or the request clearly asks you to execute.

## Step 3: Execute

Make focused edits. Keep unrelated files untouched. Prefer existing patterns.
If the plan proves materially wrong, stop and explain the adjustment needed.

## Step 4: Verify

Run the relevant tests and the full suite when feasible:

```bash
npm run lint
npm test
```

Report failures honestly.

## Step 5: Commit

When the user asks to commit, stage only files changed for this item and use
a Conventional Commit message.
