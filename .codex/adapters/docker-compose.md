# Adapter: docker-compose

Deploys with `docker compose`. This is the default adapter because it is useful
for local demos, internal tools, and simple single-host services.

## Assumptions

- `docker` and `docker compose` are on `PATH`.
- `docker-compose.yml` or `docker-compose.yaml` exists at the project root.
- HTTP services expose `/health` or `/`.
- `pipeline/runbook.md` describes rollback and health signals.

## Config

```yaml
deploy:
  adapter: docker-compose
  docker_compose:
    compose_file: docker-compose.yml
    build_no_cache: false
    smoke_test_timeout_s: 30
```

## Procedure

1. Read `pipeline/gates/stage-07.json`; if deploy approval is missing, write an `ESCALATE` Stage 8 gate and stop.
2. Confirm the compose file and `pipeline/runbook.md` exist.
3. Run `docker compose -f <compose_file> config --quiet`.
4. Run `docker compose -f <compose_file> pull --ignore-pull-failures` and record warnings.
5. Run `docker compose -f <compose_file> build`, adding `--no-cache` only when configured.
6. Run `docker compose -f <compose_file> down --remove-orphans --timeout 30`.
7. Run `docker compose -f <compose_file> up -d --wait`.
8. Smoke-test HTTP services with `curl -sf --retry 3 --retry-delay 2`.
9. Record `docker compose ps`, image details, smoke-test results, and recovery pointers in `pipeline/deploy-log.md`.

## Gate Body

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "<ISO>",
  "adapter": "docker-compose",
  "environment": "local",
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": {
    "compose_file": "docker-compose.yml",
    "services_started": []
  },
  "blockers": [],
  "warnings": []
}
```

## Runbook Hooks

The runbook must include rollback steps and health signals. A minimum rollback
is the prior image/tag procedure plus the compose commands needed to restore it.
