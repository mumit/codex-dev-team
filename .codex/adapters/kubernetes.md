# Adapter: kubernetes

Deploys via `kubectl` (optionally through Helm) against a Kubernetes cluster.
The adapter supports plain manifests and Helm charts.

> **Project-specific configuration required.** This adapter ships as a
> skeleton — every project's K8s layout differs. Fill in the
> `TODO(project)` markers below before the first Stage 8 run.

## Assumptions

- `kubectl` on PATH, pointed at the target cluster via `$KUBECONFIG` or the
  in-cluster service account
- Manifests live under a project-declared directory (default `k8s/manifests/`)
  or a Helm chart at a project-declared path (default `k8s/chart/`)
- An image registry the cluster can pull from, with the image already pushed
  to it before Stage 8 starts (usually via CI — see §Prebuild)

## Config (`.codex/config.yml`)

```yaml
deploy:
  adapter: kubernetes
  kubernetes:
    # TODO(project): choose one strategy
    strategy: manifests           # or: helm
    namespace: my-app-prod        # TODO(project)
    context: prod-cluster         # must match a kubectl context

    # Manifest strategy
    manifests_dir: k8s/manifests
    kustomize_overlay: null        # e.g. k8s/overlays/prod — optional

    # Helm strategy
    chart_dir: k8s/chart
    release_name: my-app           # TODO(project)
    values_files:
      - k8s/values.prod.yaml       # TODO(project)

    # Prebuild
    image_repository: registry.example.com/my-app  # TODO(project)
    image_tag_from: git_sha        # or: env:IMAGE_TAG, or: fixed

    # Rollout verification
    rollout_timeout_s: 300
    smoke_services:
      # TODO(project): list Services/Deployments + health endpoints
      - name: api
        url: https://api.example.com/health
      - name: worker
        check: kubectl_rollout     # no HTTP endpoint — just rollout success
```

## Prebuild

For most projects CI builds and pushes the image before Stage 8. If
`image_tag_from: git_sha`, confirm the image is already in the registry:

```bash
IMAGE_TAG=$(git rev-parse --short HEAD)
docker manifest inspect <image_repository>:${IMAGE_TAG}
```

If the project builds locally:
```bash
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -t <image_repository>:${IMAGE_TAG} .
docker push <image_repository>:${IMAGE_TAG}
```

Record the image tag used in `pipeline/deploy-log.md` under `## Image tag`
so a rollback can reference the prior tag.

## Procedure

### 1. Preconditions

- Read `pipeline/gates/stage-07.json`. Confirm `pm_signoff: true`. If
  missing or false: write `status: ESCALATE` with reason "PM sign-off
  missing — cannot deploy" and halt.
- Confirm `pipeline/runbook.md` exists with `## Rollback` and
  `## Health signals` sections. If missing: write `status: ESCALATE`.
- `kubectl config current-context` must match the configured context. If
  not: `status: ESCALATE` with reason "kubectl context mismatch — refusing
  to deploy to unexpected cluster".
- `kubectl auth can-i` for each resource type the manifest/chart creates in
  the target namespace. Lack of permission: `status: FAIL` with the
  missing permission as blocker.

### 2. Render manifests (strategy: manifests)

```bash
kubectl --context=<context> --namespace=<namespace> apply \
  --dry-run=server -f <manifests_dir>
```

If `kustomize_overlay` is set:
```bash
kubectl --context=<context> --namespace=<namespace> apply \
  --dry-run=server -k <kustomize_overlay>
```

Dry-run failure: `status: FAIL`, error as blocker.

### 2. Render manifests (strategy: helm)

```bash
helm --kube-context=<context> upgrade --install <release_name> <chart_dir> \
  --namespace <namespace> \
  --values <values_files...> \
  --set image.tag=${IMAGE_TAG} \
  --dry-run --debug
```

### 3. Apply

Plain manifests:
```bash
kubectl --context=<context> --namespace=<namespace> apply \
  [-f <manifests_dir> | -k <kustomize_overlay>]
```

Helm:
```bash
helm --kube-context=<context> upgrade --install <release_name> <chart_dir> \
  --namespace <namespace> \
  --values <values_files...> \
  --set image.tag=${IMAGE_TAG} \
  --wait --timeout ${rollout_timeout_s}s
```

### 4. Rollout verification

For each Deployment / StatefulSet in the applied manifests:
```bash
kubectl --context=<context> --namespace=<namespace> rollout status \
  deployment/<name> --timeout=${rollout_timeout_s}s
```

Any `rollout status` timeout: `status: FAIL`, capture `kubectl describe`
output + last 50 lines of pod logs as blocker.

### 5. Smoke tests

For each entry in `smoke_services`:
- `url` entries: `curl -sf --retry 3 --retry-delay 2 <url>`
- `check: kubectl_rollout`: verified already in §4 (no additional action)

### 6. Write outputs

#### `pipeline/deploy-log.md`

```markdown
# Deploy Log

**Date**: <ISO>
**Method**: kubernetes via <strategy>
**Context**: <context>
**Namespace**: <namespace>
**Image tag**: <IMAGE_TAG>
**Runbook**: pipeline/runbook.md §<recovery-section>

## Applied resources
<output of `kubectl get all -n <namespace>`>

## Rollout results
<per-deployment PASS/FAIL>

## Smoke test results
<per-service>

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
  "adapter": "kubernetes",
  "environment": "<namespace>",
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": {
    "strategy": "manifests | helm",
    "context": "<context>",
    "namespace": "<namespace>",
    "image_tag": "<tag>",
    "deployments_rolled_out": ["api", "worker"]
  },
  "blockers": [],
  "warnings": []
}
```

## Rollback

Do not auto-rollback. The runbook is the recovery authority.

kubectl rollout undo:
```bash
kubectl --context=<context> --namespace=<namespace> rollout undo deployment/<name>
```

Helm rollback:
```bash
helm --kube-context=<context> rollback <release_name> <revision> --namespace <namespace>
```

The revision to roll back to should be recorded in `pipeline/deploy-log.md`
before the apply step. Check `helm history <release_name>` for Helm revisions.

## Smoke Test Failure Notes

- `rollout status` timeout usually means: bad image tag, missing pull secret,
  or insufficient resource quota. Check `kubectl describe pod` and events.
- HTTP smoke test failures after rollout success: liveness vs. readiness probe
  mismatch, or a backing service (DB, cache) the app can't reach from the cluster.

## Runbook Hooks

This adapter expects `pipeline/runbook.md` to include:

- **§Rollback** — must name the prior image tag and a `helm rollback` or
  `kubectl rollout undo` command.
- **§Health signals** — which metrics/dashboards confirm the deploy is healthy
  post-recovery (should match brief observability requirements).
- **§Escalation** — on-call name / paging channel if the rollback itself fails.

## Known Limitations

- No blue/green or canary support in the skeleton. Projects with those patterns
  should write a `custom` adapter that invokes Argo Rollouts or Flagger.
- No cross-namespace deploys. One adapter invocation = one namespace.
- Secrets are assumed to exist in the cluster already (via ESO, Vault, Sealed
  Secrets, etc.). The adapter does NOT create secrets.
