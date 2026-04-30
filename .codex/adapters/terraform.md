# Adapter: terraform

Deploys infrastructure with Terraform or OpenTofu. Use this when Stage 8 is an
IaC apply rather than an application rollout.

## Assumptions

- `terraform` or `tofu` is on `PATH`.
- Backend credentials and state locking are configured outside the framework.
- IaC source lives in a declared working directory.
- `pipeline/runbook.md` explains state recovery and drift monitoring.

## Config

```yaml
deploy:
  adapter: terraform
  terraform:
    binary: terraform
    working_dir: infra
    workspace: prod
    var_files:
      - infra/prod.tfvars
    auto_approve: false
    plan_output_path: pipeline/terraform-plan.bin
    drift_check: true
    smoke_urls:
      - output: api_endpoint
        path: /health
```

## Procedure

1. Read `pipeline/gates/stage-07.json`; if deploy approval is missing, write an `ESCALATE` Stage 8 gate and stop.
2. Confirm `pipeline/runbook.md` exists.
3. Run `<binary> -chdir=<working_dir> init`.
4. Confirm the configured workspace exists.
5. Run `plan -detailed-exitcode -out <plan_output_path>`.
6. If `auto_approve` is false and the plan changes resources, write `ESCALATE` with a plan-review decision and stop.
7. Run `apply <plan_output_path>` only after approval or when `auto_approve` is true.
8. Run configured smoke tests using Terraform outputs.
9. Capture plan summary, apply output, outputs, smoke tests, and recovery pointers in `pipeline/deploy-log.md`.

## Gate Body

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
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

## Runbook Hooks

The runbook must name the known-good state, rollback or recovery approach,
state-lock owner, and drift checks after apply.
