# Compaction Instructions

When context is compacted, preserve only state needed to continue the current
pipeline safely.

## Preserve

1. Current pipeline stage and active track.
2. Gate files written and their statuses.
3. Open `ESCALATE` gates and their `decision_needed` text.
4. Open `QUESTION:` and `CONCERN:` entries in `pipeline/context.md`.
5. Stage 4 build areas that are complete.
6. Stage 6 review files that have been written.
7. Stage 6 review round count per area, including changes-requested cycles.
8. Retry count and owning role for any stage currently retrying.
9. Stage 9a agents that have contributed.
10. Whether Stage 9b synthesis completed and which lessons were promoted or
    retired.

## Do Not Preserve

- Full file contents that can be re-read from disk.
- Private reasoning or scratch notes.
- Tool output already written to `pipeline/` artifacts.
- Long diffs when a file path and summary is enough.

After compaction, re-read `pipeline/context.md`, `pipeline/lessons-learned.md`,
and the latest gates before continuing.
