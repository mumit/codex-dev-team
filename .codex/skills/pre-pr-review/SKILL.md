---
name: pre-pr-review
description: "Review the current branch before opening a PR. Use when the user asks for a pre-PR review, code review, merge readiness check, or asks what they missed."
---

# Pre-PR Review Skill

Take a code-review stance. Findings come first.

## Review Order

1. Inspect branch status and diff.
2. Read relevant tests and docs.
3. Look for correctness, security, maintainability, and missing tests.
4. Run targeted verification if practical.

## Output

List findings by severity with file and line references. If no issues are
found, say so clearly and name residual risk.

Do not make source edits during review unless the user asks you to fix issues.
