# Escalation Rules

Any pipeline stage may write `"status": "ESCALATE"` to its gate. An escalation
halts the pipeline until the required human or Principal decision is recorded.

## Escalate When

- A role cannot proceed without information only the user can provide.
- A reviewer finds a blocker that contradicts the approved design.
- Reviewers disagree after two rounds and neither position can be dismissed.
- The same test fails on retry 2 for the same root cause.
- Deployment needs infrastructure changes outside the approved runbook.
- PM sign-off would require re-architecture rather than a bounded fix.

## Gate Shape

```json
{
  "status": "ESCALATE",
  "escalated_by": "role-name",
  "escalation_reason": "clear one-sentence reason",
  "decision_needed": "specific question to answer",
  "options": ["option A", "option B"],
  "pipeline_halted_at": "stage-XX"
}
```

## Orchestrator Behavior

1. Stop stage advancement immediately.
2. Surface `escalation_reason`, `decision_needed`, and available options.
3. Wait for explicit user input.
4. Append the decision to `pipeline/context.md` under `## User Decisions`.
5. Resume from `pipeline_halted_at` only after the decision is recorded.

## Not Escalations

- A `FAIL` gate with an obvious owner and fix path.
- A reviewer suggestion that is not a blocker.
- A requirement already answered in `pipeline/context.md`.
