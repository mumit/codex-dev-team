---
name: code-conventions
description: "Project-wide coding standards for implementation and review. Use when writing or reviewing source code, tests, naming, error handling, and commits."
---

# Code Conventions

Load this skill when writing or reviewing code. Do not duplicate these rules in
role prompts; reference the skill.

## General

- Prefer explicit code over clever code.
- Public functions and methods should have a docstring or JSDoc when their
  behavior is not obvious from the signature.
- Replace magic numbers with named constants.
- Do not commit commented-out code.

## Naming

- Files: `kebab-case`.
- Classes and types: `PascalCase`.
- Functions and variables: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE`.
- Database columns: `snake_case`.

## Error Handling

- Never swallow errors silently.
- Async operations need explicit error handling at the boundary where failure is
  actionable.
- User-facing errors must not expose stack traces, internal paths, SQL, or
  provider secrets.

## Security

- No secrets, tokens, or credentials in source.
- Validate user input before use.
- Use parameterized SQL queries; never concatenate SQL with user input.

## Testing

- New behavior needs tests.
- Test names describe behavior, such as `returns 404 when user is missing`.
- Tests should assert observable outcomes, not implementation trivia.

## Git

- Use one logical change per commit.
- Commit subjects use imperative mood and stay concise.
- Do not push directly to protected shared branches.

## Gotchas

- Avoid TypeScript `any` unless the boundary truly cannot be typed.
- Avoid `SELECT *`; name columns explicitly.
- Keep unrelated refactors out of feature commits.
