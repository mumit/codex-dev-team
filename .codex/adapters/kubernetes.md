# Adapter: kubernetes

Deploys with `kubectl` and optionally Helm. This adapter is a skeleton because
cluster topology, namespaces, and rollout strategy are project-specific.

## Assumptions

- `kubectl` is on `PATH` and points to the intended cluster.
- Manifests or Helm charts live in project-declared paths.
- Images are built and pushed before Stage 8, unless the project explicitly documents local build/push.
- `pipeline/runbook.md` contains rollback, health signals, and escalation contacts.

## Config

```yaml
deploy:
  adapter: kubernetes
  kubernetes:
    strategy: manifests
    context: prod-cluster
    namespace: app-prod
    manifests_dir: k8s/manifests
    chart_dir: k8s/chart
    release_name: app
    rollout_timeout_s: 300
    smoke_services:
      - name: api
        url: https://api.example.com/health
```

## Procedure

1. Read `pipeline/gates/stage-07.json`; if deploy approval is missing, write an `ESCALATE` Stage 8 gate and stop.
2. Confirm `pipeline/runbook.md` exists.
3. Confirm `kubectl config current-context` matches the configured context.
4. Check permissions with `kubectl auth can-i` for affected resources.
5. Render manifests or Helm templates with server-side dry run.
6. Apply manifests or run `helm upgrade --install --wait`.
7. Verify rollout status for each Deployment or StatefulSet.
8. Run configured HTTP smoke tests or rollout-only checks.
9. Capture applied resources, rollout results, smoke tests, and recovery pointers in `pipeline/deploy-log.md`.

## Gate Body

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "<ISO>",
  "adapter": "kubernetes",
  "environment": "<namespace>",
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": {
    "strategy": "manifests",
    "context": "<context>",
    "namespace": "<namespace>",
    "deployments_rolled_out": []
  },
  "blockers": [],
  "warnings": []
}
```

## Runbook Hooks

The runbook must name rollback commands such as `kubectl rollout undo` or
`helm rollback`, plus health dashboards and escalation contacts.
