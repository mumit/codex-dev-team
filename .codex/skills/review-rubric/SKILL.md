---
name: review-rubric
description: "Mandatory Stage 6 code-review rubric. Use when performing pipeline peer review or classifying review findings."
---

# Review Rubric

Use this skill for pipeline Stage 6 peer reviews. For direct non-pipeline
changes, use `pre-pr-review`.

## Mandatory Checks

### Spec Compliance

- Does the code match `pipeline/design-spec.md`?
- Are API contracts implemented as specified?
- Are deviations documented in `pipeline/context.md` or an ADR?

### Correctness

- Are spec edge cases handled?
- Are error paths handled and tested?
- Are there off-by-one errors, null dereferences, race conditions, or type
  mismatches?

### Security

- No secrets in code.
- Input validation is present at boundaries.
- Auth and authorization checks exist where required.
- SQL or query construction is parameterized.

### Test Coverage

- New behavior has corresponding tests.
- Tests assert behavior rather than simply executing code.
- Acceptance criteria have a visible test mapping.

### Readability

- A new maintainer can follow the main path quickly.
- Complex sections have short explanatory comments.
- Names match local conventions.

## Comment Classification

`BLOCKER`: must be fixed before approval. Use for security issues, missing
tests, spec violations, and broken behavior.

`SUGGESTION`: improves maintainability but does not block merge.

`QUESTION`: asks for clarification. It becomes a blocker only if the answer
reveals a spec, safety, or correctness issue.

## Verdicts

- `REVIEW: APPROVED`: no blockers remain.
- `REVIEW: CHANGES REQUESTED`: one or more blockers remain.

## Gotchas

- Do not approve by vibes; work through the checklist.
- Read existing review files before adding duplicate findings.
- Do not mark style preferences as blockers when a linter or convention does
  not require them.
