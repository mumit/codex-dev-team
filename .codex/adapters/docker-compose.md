# Adapter: docker-compose (default)

Deploys via `docker compose` against a local or remote host. This is the
default adapter. Best for local dev, demos, and simple single-host services.

## Assumptions

- `docker` and `docker compose` are on PATH
- A `docker-compose.yml` exists at the project root (or `docker-compose.yaml`)
- Every HTTP service in the compose file has a `healthcheck:` block so
  `docker compose up --wait` can verify readiness
- `.env` carries any secrets the compose file references

## Config (`.codex/config.yml`)

```yaml
deploy:
  adapter: docker-compose
  docker_compose:
    compose_file: docker-compose.yml   # TODO(project): or docker-compose.yaml
    build_no_cache: true               # force rebuild on deploy
    smoke_test_timeout_s: 30
```

## Prebuild

Images are built inline during the deploy procedure (Step 4). No separate
prebuild step is required for this adapter. If the project uses a multi-stage
pipeline that pre-builds images and publishes to a registry before Stage 8:
- Set `build_no_cache: false` and update the compose file's image references
  to use the pre-built tags.
- Document the registry and tag convention in `pipeline/runbook.md` under
  `## Image tags`.

## Procedure

Follow in order. On any failure: capture the failing command's output, write
`status: FAIL` to `pipeline/gates/stage-08.json` with the output as a
blocker, and halt. Do not auto-rollback.

### 1. Preconditions

- Read `pipeline/gates/stage-07.json` (or stage-08.json sign-off field).
  Confirm `pm_signoff: true`. If missing or false: write `status: ESCALATE`
  with reason "PM sign-off missing — cannot deploy" and halt.
- Confirm the compose file named in config exists. If missing: write
  `status: ESCALATE` with reason "No docker-compose.yml found".
- Confirm `pipeline/runbook.md` exists and has `## Rollback` and
  `## Health signals` sections. If missing: write `status: ESCALATE` with
  reason "Runbook required for Stage 8". See `templates/runbook-template.md`.

### 2. Validate compose config

```bash
docker compose -f <compose_file> config --quiet
```

Non-zero exit: write `status: FAIL` with the error as blocker. Halt.

### 3. Pull upstream base images

```bash
docker compose -f <compose_file> pull --ignore-pull-failures
```

Non-fatal. Log any warnings; continue.

### 4. Build images

```bash
docker compose -f <compose_file> build <--no-cache if configured>
```

Non-zero exit: `status: FAIL`, build output as blocker. Halt.

### 5. Stop existing containers gracefully

```bash
docker compose -f <compose_file> down --remove-orphans --timeout 30
```

Drains existing containers before starting new ones.

### 6. Start services

```bash
docker compose -f <compose_file> up -d --wait
```

`--wait` blocks until all services with healthchecks report healthy.
A service with no healthcheck returns immediately — relying on the
smoke-test phase to catch silent failures.

### 7. Smoke tests

Wait 5 seconds after `up` returns. Then for each service in the compose file:

**HTTP service** (has `ports:` mapping to 80/443/3000/8000/8080/etc.):
```bash
curl -sf --retry 3 --retry-delay 2 http://localhost:<PORT>/health \
  || curl -sf --retry 3 --retry-delay 2 http://localhost:<PORT>/
```
A 2xx or 3xx response passes.

**Non-HTTP service** (database, queue, worker):
```bash
docker compose -f <compose_file> ps --format json \
  | grep -q '"Status":"running"'
```

On smoke-test failure:
```bash
docker compose -f <compose_file> logs --tail=50
```
Capture logs, write `status: FAIL` with logs as blocker, halt.

### 8. Record container state

```bash
docker compose -f <compose_file> ps
docker compose -f <compose_file> images
```

Both outputs go into `pipeline/deploy-log.md`.

### 9. Write outputs

#### `pipeline/deploy-log.md`

```markdown
# Deploy Log

**Date**: <ISO timestamp>
**Method**: docker compose (local)
**Runbook**: pipeline/runbook.md §<recovery-section-name>

## Services Started
<output of docker compose ps>

## Images
<output of docker compose images>

## Smoke Test Results
<pass/fail per service with endpoint or check used>

## Known Limitations
<any warnings from earlier steps>

## Recovery procedure
<one-line pointer to runbook — orchestrator does NOT auto-rollback>
```

See `## Gate Body` below for the gate shape.

## Rollback

Do not auto-rollback. The runbook is the recovery authority.

A typical rollback:
```bash
# Bring down the failed deployment
docker compose -f <compose_file> down --remove-orphans --timeout 30
# Restore the prior image tag in docker-compose.yml or via override, then:
docker compose -f <compose_file> up -d --wait
```

Record the prior image tags in `pipeline/deploy-log.md` before overwriting so
a rollback can reference them.

## Gate Body

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "<track>",
  "timestamp": "<ISO>",
  "adapter": "docker-compose",
  "environment": "local",
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": {
    "compose_file": "docker-compose.yml",
    "services_started": ["<list>"]
  },
  "blockers": [],
  "warnings": []
}
```

## Smoke Test Failure Notes

- If `--wait` hangs, check `docker compose logs <service>` for OOM kills or
  init failures. Most common cause: missing healthcheck in the compose file.
- If a health endpoint returns 5xx immediately after start, check env vars —
  often a missing secret or misconfigured DB connection string.

## Runbook Hooks

This adapter expects `pipeline/runbook.md` to include:

- **§Recovery** — how to roll the deploy back. Minimum answer:
  `docker compose -f <file> down && docker compose -f <file> up -d --wait`
  against the prior image tag.
- **§Health signals** — which smoke test confirms the deploy is healthy
  post-recovery.

See `templates/runbook-template.md` for the full section list.
