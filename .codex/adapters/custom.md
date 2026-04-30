# Adapter: custom

Runs a project-provided deployment script. Use this when built-in adapters do
not fit and the project already has a reliable deploy entrypoint.

## Assumptions

- The script path is relative to the project root.
- The script is executable and returns non-zero on failure.
- The script is safe enough to rerun or its limitations are documented.
- `pipeline/runbook.md` explains rollback and script behavior.

## Config

```yaml
deploy:
  adapter: custom
  custom:
    script: scripts/deploy.sh
    args:
      - --environment
      - prod
    timeout_s: 1200
    smoke_commands:
      - curl -sf https://api.example.com/health
```

## Procedure

1. Read `pipeline/gates/stage-07.json`; if deploy approval is missing, write an `ESCALATE` Stage 8 gate and stop.
2. Confirm `pipeline/runbook.md` exists.
3. Confirm the configured script exists and is executable.
4. Run `timeout <timeout_s> <script> <args...>`.
5. Run each smoke command after the script succeeds.
6. Capture script output, smoke results, and recovery pointers in `pipeline/deploy-log.md`.

## Gate Body

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "<ISO>",
  "adapter": "custom",
  "environment": "<from config or script output>",
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": {
    "script": "scripts/deploy.sh",
    "exit_code": 0,
    "duration_s": 0
  },
  "blockers": [],
  "warnings": []
}
```

## Runbook Hooks

The runbook must document rollback and the script contract. If this script
becomes shared across projects, promote it to a named adapter.
