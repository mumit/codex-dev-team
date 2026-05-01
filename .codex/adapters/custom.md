# Adapter: custom

Escape hatch. Runs a project-provided deploy script. Use when the built-in
adapters don't fit and writing a new adapter file isn't worth the investment yet.

The custom adapter is minimalist by design — the project owns the substance;
this file just frames the inputs, outputs, and gate contract.

## Assumptions

- The project has a script that, when given a plan file and the working
  directory, deploys the current build. The script is idempotent enough
  that re-running is not catastrophic.
- The script either succeeds (exit 0 and the deploy is live) or fails
  (non-zero exit with stderr that a human can read).

## Config (`.codex/config.yml`)

```yaml
deploy:
  adapter: custom
  custom:
    # TODO(project): path relative to the project root. Must be executable.
    script: scripts/deploy.sh
    # Optional args passed to the script
    args:
      - --environment
      - prod
    # How long to wait for the script before declaring hung
    timeout_s: 1200
    # Optional smoke-test commands the adapter runs AFTER the script
    # completes. Each entry is a shell command; a zero exit = pass.
    smoke_commands:
      # TODO(project): add smoke-test commands
      - curl -sf https://api.example.com/health
      - ./scripts/check_queue_depth.sh
```

## Prebuild

The custom adapter does not define a prebuild step — the deploy script owns
its own build/push story. Document any prebuild steps in `pipeline/runbook.md`
under `## Prebuild` so that a fresh environment can replicate the run.

If the script builds images or assets, record the artifact identifiers (image
tags, artifact IDs) in `pipeline/deploy-log.md` before overwriting them so a
rollback can reference the prior version.

## Procedure

### 1. Preconditions

- Stage 7 gate check: confirm `pm_signoff: true`. If absent: write
  `status: ESCALATE` with reason "PM sign-off missing — cannot deploy" and halt.
- `pipeline/runbook.md` must exist with `## Rollback` and `## Script contract`
  sections. If missing: write `status: ESCALATE`.
- `script` path must exist and be executable. If not: `status: FAIL`
  with the path as blocker.

### 2. Run the script

```bash
timeout <timeout_s> <script> <args...>
```

Capture stdout and stderr to `pipeline/deploy-log.md`.

Non-zero exit: `status: FAIL`, stderr as blocker, halt.
Timeout: `status: FAIL`, reason "deploy script exceeded <timeout_s>s", halt.

### 3. Smoke tests

For each `smoke_commands` entry:

```bash
<command>
```

Zero exit = pass. Any non-zero: capture the command, exit code, and stderr
as a blocker. `status: FAIL`, halt.

### 4. Write outputs

#### `pipeline/deploy-log.md`

```markdown
# Deploy Log

**Date**: <ISO>
**Method**: custom — <script>
**Runbook**: pipeline/runbook.md §<section>

## Script invocation
<script> <args>

## Script output
<captured stdout/stderr>

## Smoke tests
<per-command pass/fail with exit code>

## Recovery procedure
See runbook §Rollback.
```

See `## Gate Body` below for the gate shape.

## Gate Body

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "<track>",
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

## Rollback

Do not auto-rollback. The deploy script's behavior on rollback is
project-specific and not assumed safe to run again automatically.

The `pipeline/runbook.md §Rollback` section must describe:
- The rollback command or script path
- Whether it is safe to run multiple times
- Any preconditions (e.g. the deploy must have completed before rollback is valid)

## Smoke Test Failure Notes

- A failed smoke command does not automatically mean the deploy is broken.
  Some post-deploy checks are advisory. If a check is advisory, mark it as
  such in `pipeline/runbook.md §Script contract` and convert it to a warning
  rather than a blocker.
- For long-running deploys that take time to become healthy, add a retry loop
  in the smoke command itself or increase `timeout_s`.

## Failure-Mode Notes

- If the script is not idempotent: do NOT re-run it as a recovery path.
  The runbook `§Script contract` must declare whether the script is safe to
  re-run and under what conditions.
- If the script times out: check for hung processes via `ps aux`. The timed-out
  script may still be running in the background — address that before retrying.
- If the script exits non-zero but the deploy succeeded: this is a script bug.
  Fix the script, update the runbook, and promote to a named adapter.

## When to Switch to a Named Adapter

If the custom script grows past ~100 lines or gets re-used across projects,
promote it to a proper adapter file under `.codex/adapters/` following
`README.md §Writing a new adapter`.

## Runbook Hooks

`pipeline/runbook.md` must include:

- **§Rollback** — the project's rollback procedure. The custom adapter does not
  attempt a rollback; the runbook is the authoritative source.
- **§Script contract** — what the deploy script does and doesn't do, so a
  future on-call engineer can trust its idempotency claims.
- **§Prebuild** — any image build, asset compilation, or push steps that must
  happen before the script is invoked.
