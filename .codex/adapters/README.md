# Deployment Adapters

Stage 8 deployment is pluggable. Each adapter provides a concrete procedure for
how the Platform role builds, deploys, and smoke-tests a release. Projects pick
one adapter in `.codex/config.yml`:

```yaml
deploy:
  adapter: docker-compose  # or: kubernetes, terraform, custom
```

## Why Adapters

Prior to adapters, deployment was hardcoded to `docker compose`. That is fine
for local demos and toy projects but useless for any real environment (K8s,
serverless, cloud IaC, enterprise CI/CD). Adapters let a project declare its
actual deployment story without rewriting the platform role prompt.

## Built-in Adapters

| Adapter | File | Suits |
|---|---|---|
| `docker-compose` (default) | `docker-compose.md` | Local dev, demos, single-host deploys |
| `kubernetes`               | `kubernetes.md`    | K8s clusters via `kubectl` / Helm     |
| `terraform`                | `terraform.md`     | IaC-managed infra on any cloud        |
| `custom`                   | `custom.md`        | Project-specific script (escape hatch) |

## Contract

Every adapter MUST satisfy the following contract. Adapters that omit any of
these items are incomplete — do not use them for a Stage 8 run.

### Required Config Keys

The adapter document must list a `Config (.codex/config.yml)` section naming
each key it reads. At minimum:
- `deploy.adapter` — the adapter name
- Any adapter-specific sub-key block (e.g. `deploy.docker_compose`)
- `TODO(project)` markers for any key the project must supply

### Required Procedure Steps

The adapter procedure must include these steps in order:

1. **Preconditions** — verify Stage 7 `pm_signoff: true`, verify
   `pipeline/runbook.md` exists with `## Rollback` section, verify adapter
   prerequisites (CLI tools, config files, credentials).
2. **Execute** — the adapter-specific build and deploy commands, each with
   a defined failure mode that writes `status: FAIL` or `status: ESCALATE`.
3. **Verify** — smoke tests confirming the deploy is live and healthy.
4. **Log** — write `pipeline/deploy-log.md` with commands run, results,
   smoke tests, and a recovery pointer.

### Required Gate Body Shape

`pipeline/gates/stage-08.json` must include, in addition to the baseline
gate fields (`stage`, `status`, `agent`, `track`, `timestamp`, `blockers`,
`warnings`):

```json
{
  "adapter": "<adapter-name>",
  "environment": "<target environment or namespace>",
  "smoke_test_passed": true | false,
  "runbook_referenced": true,
  "adapter_result": {
    // adapter-specific fields — documented per adapter
  }
}
```

### Required Runbook Hooks

Every adapter must document a `Runbook Hooks` section naming which sections of
`pipeline/runbook.md` the adapter depends on. At minimum:
- `## Rollback` — adapter-specific rollback commands
- `## Health signals` — what confirms the deploy is healthy post-recovery

### Required Failure-Mode Notes

Every adapter must document how to handle failure: what leaves a partial state
that must not be retried, what is safe to retry, and where not to auto-rollback.

## Writing a New Adapter

To add a new adapter (e.g. `nomad`, `ecs`, `cloudfoundry`):

1. Create `.codex/adapters/<name>.md` following the structure of the built-in
   adapters. Include all sections required by this contract.
2. Document your adapter's name and suitability in the table above.
3. Test by running a pipeline end-to-end against a representative target
   environment.

Adapters are Markdown instructions, not code. The Platform role reads the
selected adapter's Markdown and follows it. This keeps the surface easy to
extend and review — adding an adapter is writing down what you would do by
hand, not shipping a new module.

## Selecting an Adapter

The default is `docker-compose`. To change:

1. Edit `.codex/config.yml`:
   ```yaml
   deploy:
     adapter: kubernetes
   ```
2. Adjust adapter-specific config in the same file — each adapter's
   documentation lists what it reads, including `TODO(project)` markers.
3. Run `npm run pipeline -- "<feature>"` or `npm run hotfix -- "<bug>"` as
   normal; the Platform role picks up the new adapter automatically.

Note: `.codex/config.yml` may carry environment-specific credentials or
paths. Review the adapter's doc for exactly which fields are safe to commit
versus which should live in a gitignored local override file.
