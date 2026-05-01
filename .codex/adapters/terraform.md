# Adapter: terraform

Deploys infrastructure changes via `terraform` (or `tofu`) against a declared
backend. Best for infra-layer deploys (VPCs, queues, databases, managed
services) where the "deploy" is the IaC apply.

> **Project-specific configuration required.** Fill in the
> `TODO(project)` markers before the first Stage 8 run.

## Assumptions

- `terraform` (or `tofu`) on PATH
- A configured Terraform backend (S3+DynamoDB, Terraform Cloud, GCS, etc.)
  with credentials available in the environment
- IaC source under a project-declared directory (default `infra/`)
- The executing principal has permissions the declared resources require

## Config (`.codex/config.yml`)

```yaml
deploy:
  adapter: terraform
  terraform:
    binary: terraform                 # or: tofu
    working_dir: infra                # TODO(project): where the HCL lives
    workspace: prod                    # TODO(project)
    var_files:
      - infra/prod.tfvars              # TODO(project)
    auto_approve: false                # if true, skip plan-inspection halt
    plan_output_path: pipeline/terraform-plan.bin
    # Optional drift check before apply
    drift_check: true
    # Optional post-apply HTTP smoke tests (on outputs)
    smoke_urls:
      # TODO(project): URLs exposed by Terraform outputs
      - output: api_endpoint
        path: /health
```

## Prebuild (plan staging)

Before Stage 8 starts, confirm the plan is sensible. This is typically
done during the QA or sign-off stage as a sanity check:

```bash
terraform -chdir=<working_dir> init
terraform -chdir=<working_dir> workspace select <workspace>
terraform -chdir=<working_dir> plan -detailed-exitcode \
  -out <plan_output_path> [-var-file=<var_files>...]
```

Save the plan binary for apply. The plan binary is deterministic for a
given input state — re-running plan between sign-off and apply is safe
as long as the state hasn't drifted.

## Procedure

### 1. Preconditions

- Stage 7 gate check: confirm `pm_signoff: true`. If absent: write
  `status: ESCALATE` with reason "PM sign-off missing — cannot deploy" and halt.
- `pipeline/runbook.md` must exist with `## Rollback` section.
- Backend must be initialised:
  ```bash
  terraform -chdir=<working_dir> init
  ```
  Any failure: `status: FAIL` with init output as blocker.
- Workspace must exist:
  ```bash
  terraform workspace list
  ```
  If missing, `status: ESCALATE` — new workspaces require human intent.

### 2. Drift check (enabled by default when `drift_check: true`)

```bash
terraform -chdir=<working_dir> plan -detailed-exitcode \
  -out <plan_output_path> [-var-file=<var_files>...]
```

Exit codes:
- `0` → no changes; proceed but record "no-op deploy" in the log
- `2` → changes planned; proceed to inspection
- any other → `status: FAIL` with plan output as blocker

### 3. Plan inspection

Summarise the plan to `pipeline/deploy-log.md` under `## Plan`:

```bash
terraform -chdir=<working_dir> show -json <plan_output_path>
```

If `auto_approve: false` (default): **halt with `status: ESCALATE`** and
`"decision_needed": "Review plan at <path> before apply"`. The orchestrator
surfaces the plan summary to the user and waits for a `proceed` or `abort`
decision.

If `auto_approve: true`: proceed to apply.

### 4. Apply

```bash
terraform -chdir=<working_dir> apply <plan_output_path>
```

Non-zero exit: `status: FAIL`, apply output as blocker. Do not
auto-rollback — state is now partially modified. The runbook must
name the recovery path.

### 5. Smoke tests

For each entry in `smoke_urls`:

```bash
ENDPOINT=$(terraform -chdir=<working_dir> output -raw <output>)
curl -sf --retry 3 --retry-delay 2 "${ENDPOINT}<path>"
```

A 2xx or 3xx passes. Failure captures the curl output + the outputs block
(`terraform output -json`) into the deploy log.

### 6. Write outputs

#### `pipeline/deploy-log.md`

```markdown
# Deploy Log

**Date**: <ISO>
**Method**: terraform
**Workspace**: <workspace>
**Binary**: <binary version>
**Runbook**: pipeline/runbook.md §<section>

## Plan summary
<human-readable summary of resources added/changed/destroyed>

## Apply output
<last 50 lines of terraform apply output>

## Outputs
<terraform output -json>

## Smoke tests
<pass/fail per URL>

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
  "adapter": "terraform",
  "environment": "<workspace>",
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": {
    "binary": "terraform",
    "workspace": "<workspace>",
    "resources_added": 0,
    "resources_changed": 0,
    "resources_destroyed": 0
  },
  "blockers": [],
  "warnings": []
}
```

## Rollback

Do not auto-rollback. State is the source of truth; the runbook must describe
the recovery path explicitly.

Typical rollback options:
- **Targeted destroy + recreate**: if the apply added a broken resource.
  `terraform -chdir=<working_dir> destroy -target=<resource>`
- **State rollback**: if using Terraform Cloud, restore a prior state version.
  If using S3 backend, retrieve the prior state object from S3 versioning.
- **Known-good commit**: check out the IaC commit that last applied cleanly
  and re-plan + apply. Record this commit in `pipeline/runbook.md §Known-good state`.

State locking errors halt with `status: FAIL` — do not force-unlock from the
adapter. The runbook should name who holds unlock authority.

## Smoke Test Failure Notes

- If a Terraform output is empty or missing after apply, the resource may have
  been created but is not yet reachable (DNS propagation, LB initialisation).
  Add a `sleep 30` or retry loop in a custom smoke step if the project needs it.
- `terraform output -raw` returns a blank exit code even when the output is
  undefined — check for non-empty value explicitly.

## Runbook Hooks

Expects `pipeline/runbook.md` to include:

- **§Rollback** — exact procedure to revert the state, including whether
  data is recoverable and from where.
- **§Known-good state** — reference to the Terraform state version (or
  commit SHA) to roll back to.
- **§Drift watch** — what to monitor after apply (changed IAM policies,
  security-group rules, DNS propagation).

## Known Limitations

- No multi-workspace apply in one run. Deploy to each workspace is a separate
  Stage 8 invocation.
- Cross-provider race conditions are the project's problem; the adapter does not
  sequence or coordinate with other deploys.
