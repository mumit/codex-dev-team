# Deployment Adapters

Stage 8 deployment is pluggable. The selected adapter tells the Platform role
how to build, deploy, smoke-test, and write `pipeline/deploy-log.md` plus
`pipeline/gates/stage-08.json`.

Select an adapter in `.codex/config.yml`:

```yaml
deploy:
  adapter: docker-compose
```

Built-in adapters:

| Adapter | File | Use |
|---|---|---|
| `docker-compose` | `docker-compose.md` | Local demos and single-host services |
| `kubernetes` | `kubernetes.md` | Clusters via `kubectl` or Helm |
| `terraform` | `terraform.md` | IaC-managed infrastructure deploys |
| `custom` | `custom.md` | Project-owned deploy scripts |

## Contract

Every adapter must:

1. Read `pipeline/gates/stage-07.json` and confirm deployment is allowed before touching infrastructure.
2. Require `pipeline/runbook.md` before a passing Stage 8 gate.
3. Halt on non-zero deploy or smoke-test commands and write blockers to `pipeline/gates/stage-08.json`.
4. Write `pipeline/deploy-log.md` with commands run, results, smoke tests, and recovery pointers.
5. Write `pipeline/gates/stage-08.json` with `adapter`, `environment`, `smoke_test_passed`, `runbook_referenced`, and `adapter_result`.
6. Avoid automatic rollback. The runbook is the source of truth for recovery.

Adapters are Markdown instructions, not hidden executors. This keeps deployment
behavior reviewable and project-specific while preserving deterministic gates.
