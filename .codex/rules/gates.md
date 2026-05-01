# Gate Schema

Every pipeline stage writes a JSON gate file under `pipeline/gates/`.
The gate file is the authoritative machine-readable status record.
The orchestrator reads JSON, not prose.

## Required Fields

```json
{
  "stage": "stage-01",
  "status": "PASS",
  "agent": "pm",
  "track": "full",
  "timestamp": "2026-04-29T12:00:00Z",
  "blockers": [],
  "warnings": []
}
```

## Valid Statuses

- `PASS` — stage completed and the pipeline may proceed
- `FAIL` — stage failed and should retry with the owning role
- `ESCALATE` — a human or Principal decision is required before continuing

## Valid Tracks

- `full`
- `quick`
- `nano`
- `config-only`
- `dep-update`
- `hotfix`

## Stage-Specific Extra Fields

Stage-specific fields are additive. The baseline schema is strict about core
status and permissive about role-specific payloads so the framework can evolve
without breaking older target projects.

### Stage 01 — Requirements

```json
{
  "stage": "stage-01",
  "status": "PASS",
  "agent": "pm",
  "track": "full",
  "timestamp": "<ISO>",
  "acceptance_criteria_count": 5,
  "out_of_scope_items": ["SMS reset", "Social login recovery"],
  "required_sections_complete": true,
  "blockers": [],
  "warnings": []
}
```

`required_sections_complete` must be `true` when the brief contains all
sections required for its track:

- Every track: Problem, Stories, Acceptance Criteria, Out of Scope, Open Questions
- `full` and `hotfix`: also Rollback, Feature Flag, Data Migration,
  Observability, SLO, Cost sections
- `quick`, `config-only`, `dep-update`: the above plus either all six
  extended sections or a single `## Risk notes` line when the change is
  trivial on all six dimensions

### Stage 02 — Design

```json
{
  "stage": "stage-02",
  "status": "PASS",
  "agent": "principal",
  "track": "full",
  "timestamp": "<ISO>",
  "arch_approved": true,
  "pm_approved": true,
  "adr_count": 2,
  "blockers": [],
  "warnings": []
}
```

### Stage 04 — Build (per area)

```json
{
  "stage": "stage-04-backend",
  "status": "PASS",
  "agent": "codex-team",
  "track": "full",
  "timestamp": "<ISO>",
  "area": "backend",
  "files_changed": ["src/backend/routes/auth.js", "src/backend/services/tokenService.js"],
  "blockers": [],
  "warnings": []
}
```

### Stage 05 — Pre-review (lint + type-check + SCA)

```json
{
  "stage": "stage-05",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "<ISO>",
  "lint_passed": true,
  "tests_passed": true,
  "dependency_review_passed": true,
  "security_review_required": false,
  "sca_findings": { "high": 0, "critical": 0 },
  "license_check_passed": true,
  "blockers": [],
  "warnings": []
}
```

Runs after all Stage 4 area gates pass and before Stage 6 peer review starts.
See `.codex/rules/pipeline.md` Stage 5 for the full heuristic.

When the security heuristic fires, a second gate is written:

```json
{
  "stage": "stage-05-security",
  "status": "PASS",
  "agent": "security",
  "track": "full",
  "timestamp": "<ISO>",
  "security_approved": true,
  "veto": false,
  "triggering_conditions": ["path:auth", "dep:upgrade"],
  "blockers": [],
  "warnings": []
}
```

A `veto: true` gate halts the pipeline regardless of other gates. When the
heuristic does not fire, no security gate is written and the orchestrator
records `SECURITY-SKIP: <reason>` in `pipeline/context.md`.

### Stage 06 — Peer Review (per area)

```json
{
  "stage": "stage-06-backend",
  "status": "PASS",
  "agent": "codex-team",
  "track": "full",
  "timestamp": "<ISO>",
  "area": "backend",
  "review_shape": "scoped",
  "required_approvals": 1,
  "approvals": ["dev-platform"],
  "changes_requested": [],
  "escalated_to_principal": false,
  "blockers": [],
  "warnings": []
}
```

**Review shape** — the orchestrator picks before Stage 6 begins:

- `scoped` — diff is area-contained; `required_approvals: 1`. Pre-create this
  gate before invoking the reviewer — the hook defaults to `required_approvals: 2`
  on newly-created gates and a single scoped approval will never flip to PASS.
- `matrix` — diff crosses areas; `required_approvals: 2`. The full matrix
  applies: each dev reviews the other two areas.

Matrix gate example (cross-area change):

```json
{
  "stage": "stage-06-backend",
  "status": "FAIL",
  "agent": "codex-team",
  "track": "full",
  "timestamp": "<ISO>",
  "area": "backend",
  "review_shape": "matrix",
  "required_approvals": 2,
  "approvals": ["dev-frontend"],
  "changes_requested": [],
  "escalated_to_principal": false,
  "blockers": ["Awaiting dev-platform approval"],
  "warnings": []
}
```

**Authorship.** The `approvals` and `changes_requested` arrays are written by
the `approval-derivation.js` hook, not by the reviewer role. The hook parses
`REVIEW: APPROVED` / `REVIEW: CHANGES REQUESTED` markers in
`pipeline/code-review/by-<reviewer>.md` and reconciles the gate. Agents that
write `approvals` directly will have their writes overwritten on the next
reviewer file save — the hook is authoritative.

**Status resolution.** `status: "PASS"` when
`approvals.length >= required_approvals` AND `changes_requested` is empty.
Otherwise `status: "FAIL"`.

### Stage 07 — QA

```json
{
  "stage": "stage-07",
  "status": "PASS",
  "agent": "qa",
  "track": "full",
  "timestamp": "<ISO>",
  "all_acceptance_criteria_met": true,
  "tests_total": 23,
  "tests_passed": 23,
  "tests_failed": 0,
  "failing_tests": [],
  "assigned_retry_to": null,
  "criterion_to_test_mapping_is_one_to_one": true,
  "blockers": [],
  "warnings": []
}
```

`criterion_to_test_mapping_is_one_to_one` is required for the Stage 8
auto-fold. Set `true` only if every acceptance criterion has a dedicated test
and no test covers multiple criteria with distinct verify conditions. When in
doubt, set `false` and let the PM perform a manual sign-off.

### Stage 08 — Sign-off and Deploy (adapter-driven)

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "<ISO>",
  "adapter": "docker-compose",
  "environment": "production",
  "pm_signoff": true,
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": { "compose_up_exit": 0, "services_healthy": ["api", "worker"] },
  "blockers": [],
  "warnings": []
}
```

The gate passes only when `status: "PASS"` AND `runbook_referenced: true`. A
missing runbook causes `status: "ESCALATE"` at the start of Stage 8, not a
FAIL later.

**Auto-fold from Stage 7.** When Stage 7 has `all_acceptance_criteria_met:
true` and a 1:1 criterion-to-test mapping, the orchestrator writes Stage 8
sign-off directly:

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "orchestrator",
  "track": "<track>",
  "timestamp": "<ISO>",
  "pm_signoff": true,
  "deploy_requested": false,
  "runbook_referenced": false,
  "auto_from_stage_07": true,
  "blockers": [],
  "warnings": ["Deployment not requested by auto-fold"]
}
```

The `auto_from_stage_07` flag is the discriminator. The `agent` field is
`"orchestrator"` — downstream tooling that filters gates by author should
allow both values for stage-08. See Stage 8 in `pipeline.md` for skip
conditions.

### Stage 09 — Retrospective

Informational gate — status is PASS unless synthesis itself failed.

```json
{
  "stage": "stage-09",
  "status": "PASS",
  "agent": "principal",
  "track": "full",
  "timestamp": "<ISO>",
  "severity": "green",
  "lessons_promoted": ["L007 — clarify notify channel in brief"],
  "lessons_retired": [],
  "aged_out": [],
  "patterns_harvested": 3,
  "contributions_written": [
    "pm", "principal",
    "dev-backend", "dev-frontend", "dev-platform", "dev-qa"
  ],
  "blockers": [],
  "warnings": []
}
```

`severity` values: `green` (no blockers, clean run), `yellow` (warnings or
escalations resolved), `red` (pipeline halted or retro failed).

---

## Retry Protocol

On FAIL gates with retries, include:

```json
{
  "retry_number": 1,
  "previous_failure_reason": "string",
  "this_attempt_differs_by": "string — required, must be non-empty"
}
```

If `retry_number` is 1 or greater, `this_attempt_differs_by` must be a
non-empty string. Validator exits 1 when this field is missing or empty.

If `retry_number >= 2` AND `failing_tests` matches the previous FAIL gate
exactly: set `"status": "ESCALATE"` and halt. Same failure twice = escalate,
don't retry.

### ESCALATE shape examples

Budget breach (Stage 0):

```json
{
  "stage": "stage-budget",
  "status": "ESCALATE",
  "agent": "orchestrator",
  "track": "full",
  "timestamp": "<ISO>",
  "escalation_reason": "Budget exceeded — tokens",
  "decision_needed": "Continue (override budget), or halt and inspect?",
  "tokens_used": 520000,
  "tokens_max": 500000,
  "blockers": ["Budget ceiling reached"],
  "warnings": []
}
```

Architectural conflict in Stage 6:

```json
{
  "stage": "stage-06-backend",
  "status": "ESCALATE",
  "agent": "codex-team",
  "track": "full",
  "timestamp": "<ISO>",
  "area": "backend",
  "review_shape": "matrix",
  "required_approvals": 2,
  "approvals": [],
  "changes_requested": [{ "reviewer": "dev-frontend", "timestamp": "<ISO>" }],
  "escalated_to_principal": true,
  "escalation_reason": "Implementation contradicts design spec — principal ruling needed",
  "blockers": ["Token handling contradiction: spec says hash-only, code returns raw token"],
  "warnings": []
}
```

---

## Track Field

Every gate must carry a `"track"` field identifying which pipeline track the
gate belongs to. Valid values: `full`, `quick`, `nano`, `config-only`,
`dep-update`, `hotfix`.

The validator emits an advisory (non-blocking) when the field is missing or
carries an unrecognised value. Legacy gates without the field are treated as
`"full"` by downstream tooling.

---

## Validation

- `npm run gate:check` validates the latest gate only.
- `npm run gate:check:all` validates every gate in `pipeline/gates/`.
- `npm run pipeline:check` validates cross-stage artifact/gate consistency.
- `npm run validate` runs syntax checks, validates every gate, and checks
  cross-stage consistency.

### What the validator enforces

1. **Bypassed-escalation sweep.** If any gate has `status: "ESCALATE"` but is
   not the most recently modified, a later gate was written without resolving
   the earlier escalation. Validator exits 3.
2. **Most-recent-gate status.** Exit code 0 on PASS, 2 on FAIL, 3 on ESCALATE.
3. **Required-field presence.** Exits 1 on gates missing `stage`, `status`,
   `agent`, `timestamp`, `blockers`, or `warnings`.
4. **Retry integrity.** Exits 1 when `retry_number >= 1` without a non-empty
   `this_attempt_differs_by` string.
5. **Advisory: track field.** Warns without halting when `track` is missing or
   unrecognised.

Schema-backed stage contracts currently exist for:

- `stage-01` requirements
- `stage-02` design
- `stage-03` clarification
- `stage-04` build
- `stage-05` pre-review
- `stage-06-*` peer review
- `stage-07` QA
- `stage-08` sign-off/deploy
- `stage-09` retrospective
