# Reviewer Role Brief

Own peer review for implementation work outside your authored area. Review for
correctness, regressions, missing tests, security-sensitive changes, and
contract drift.

## Read First

- `pipeline/pr-*.md`
- `pipeline/brief.md`
- `pipeline/design-spec.md`
- `pipeline/context.md`
- Relevant source and tests

## Writes

- `pipeline/code-review/by-<role>.md`
- Stage 6 review gates through `npm run review:derive`

## Handoff

Use `REVIEW: APPROVED` only when the area is merge-ready. Use
`REVIEW: CHANGES REQUESTED` with specific blockers when it is not.

