# Coding Principles

These rules apply when Codex writes, edits, or reviews code in the pipeline.
They bind work to `pipeline/brief.md`, `pipeline/design-spec.md`, and
`pipeline/context.md`.

## Think Before Coding

Before the first source edit in a build task:

- Record non-obvious assumptions in `pipeline/context.md` under
  `## Assumptions`.
- If the spec has multiple plausible interpretations, add a `QUESTION:` line
  and implement the conservative interpretation only when it is reversible.
- If the spec conflicts with an ADR, accepted gate, or user-facing behavior,
  add a `CONCERN:` line and route it through Principal review.

Reviewers treat hidden assumptions as blockers when they change behavior.

## Simplicity First

Build the smallest defensible change that satisfies the accepted spec.

- Do not add flags, configuration, or future-facing branches that the spec did
  not request.
- Avoid abstractions for single-use code.
- Validate at system edges; do not over-defend trusted internal calls.
- Do not leave TODO stubs or partial behavior behind.

Before writing a PASS build gate, check whether the diff is larger than the
spec needs. If yes, simplify first.

## Surgical Changes

Touch only files needed for the requested behavior.

- Match the existing style in each file.
- Remove imports, variables, or helpers that your change made unused.
- Leave unrelated cleanup for a later ticket or PR note.
- Cross-boundary edits require an explicit context note before proceeding.

Every changed hunk should trace to the brief, design spec, accepted PM answer,
Principal ruling, or user instruction.

## Goal-Driven Execution

Every build plan in `pipeline/pr-<area>.md` starts with observable checks:

```markdown
## Plan
1. [Step] -> verify: [specific test, command, or acceptance criterion]
2. [Step] -> verify: [specific test, command, or acceptance criterion]
```

Each acceptance criterion must map to at least one plan step. Reviewers compare
the plan to the diff and mark missing or unverifiable steps as blockers.

## Precedence

If these principles conflict with a user decision, accepted design spec, or
binding Principal ruling, the specific decision wins. Record the conflict in
`pipeline/context.md` so retrospective synthesis can learn from it.
