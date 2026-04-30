---
name: api-conventions
description: "API design and implementation conventions for Codex Dev Team work. Use when designing, implementing, or reviewing HTTP endpoints, request/response contracts, pagination, and API errors."
---

# API Conventions

Load this skill when designing, implementing, or reviewing API endpoints.

## REST

- Use plural resource nouns: `/users`, `/orders`, not `/getUser`.
- Map HTTP methods to actions:
  - `GET`: read, idempotent, no side effects.
  - `POST`: create.
  - `PUT`: full replace.
  - `PATCH`: partial update.
  - `DELETE`: remove.
- Use nested resources only for ownership or containment:
  `GET /users/{id}/orders`.

## Request And Response Shape

- All responses are JSON with `Content-Type: application/json`.
- Success responses include a `data` key unless the status is `204`.
- Error responses use:

```json
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "User 42 not found" } }
```

- Timestamps are ISO 8601 UTC strings, such as `2026-03-26T12:00:00Z`.
- IDs are strings in responses.

## Status Codes

- `200`: successful read or update.
- `201`: successful create.
- `204`: successful delete or no-body response.
- `400`: malformed request or validation failure.
- `401`: unauthenticated.
- `403`: authenticated but unauthorized.
- `404`: missing resource.
- `409`: duplicate or state conflict.
- `422`: semantically invalid request.
- `500`: internal failure; never expose details.

## Pagination

- Use cursor pagination for lists: `?cursor=xxx&limit=20`.
- Include `next_cursor` and `has_more`.
- Default limit is 20; maximum limit is 100.

## Versioning

- Version public APIs in the URL path, such as `/api/v1/`.
- Breaking changes require a new version or an explicit migration plan.

## Gotchas

- Return `[]` instead of `null` for empty collections.
- Make `DELETE` idempotent when practical; deleting a missing resource should
  return `204` unless the design spec says otherwise.
