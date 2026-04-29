# Gate Schema

Every pipeline stage writes a JSON gate file under `pipeline/gates/`.
The gate file is the authoritative machine-readable status record.

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

- `PASS` - stage completed and the pipeline may proceed
- `FAIL` - stage failed and should retry with the owning role
- `ESCALATE` - a human or Principal decision is required before continuing

## Valid Tracks

- `full`
- `quick`
- `nano`
- `config-only`
- `dep-update`
- `hotfix`

## Retry Protocol

Retry gates include:

```json
{
  "retry_number": 1,
  "previous_failure_reason": "string",
  "this_attempt_differs_by": "string"
}
```

If `retry_number` is 1 or greater, `this_attempt_differs_by` must be a
non-empty string.

## Stage-Specific Fields

Stage-specific fields are additive. The baseline schema is intentionally
strict about core status and permissive about role-specific payloads so the
framework can evolve without breaking older target projects.

Schema-backed stage contracts currently exist for:

- `stage-01` requirements
- `stage-02` design
- `stage-05-*` review
- `stage-07` QA
- `stage-08` sign-off/deploy
- `stage-09` retrospective
