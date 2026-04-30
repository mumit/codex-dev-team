---
name: security-checklist
description: "Security checklist for design, implementation, and review. Use when changes touch auth, authorization, tokens, secrets, PII, dependencies, uploads, or infrastructure."
---

# Security Checklist

Load this skill during design review, implementation, and code review for
security-relevant changes. Any violated item may be a blocker.

## Input And Validation

- All user-supplied input is validated for type, length, and format.
- Validation errors return appropriate `400` or `422` responses.
- File uploads are validated for type and size before processing.

## Authentication And Authorization

- Protected endpoints apply authentication middleware.
- Authorization checks verify resource ownership or access rights.
- Tokens are not logged, stored in localStorage, or included in URLs.

## Data

- SQL uses parameterized queries only.
- Sensitive fields such as passwords and tokens are never returned.
- PII fields are identified in the data model and protected at boundaries.

## Secrets

- No credentials, API keys, or tokens in source.
- Environment variables or secret stores are used for runtime secrets.
- `.env` files are ignored by git.

## Dependencies

- New dependencies have a reason documented in the PR or context.
- New dependencies are checked for known vulnerabilities.

## Error Handling

- Error responses do not expose stack traces.
- Error responses do not expose internal paths, SQL, provider payloads, or
  schema details.

## Gotchas

- JWT validation must verify both signature and expiry.
- Production CORS must not use `Access-Control-Allow-Origin: *`.
- Auth endpoints require rate limiting unless the design explicitly exempts
  them with a security sign-off.
