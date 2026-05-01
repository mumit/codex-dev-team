#!/usr/bin/env node
/**
 * approval-derivation.js
 *
 * CLI script (npm run review:derive) and hook entry point.
 *
 * When invoked as a hook (stdin available and non-TTY), reads the PostToolUse
 * context and exits 0 immediately if the written file is NOT inside
 * pipeline/code-review/ — avoiding filesystem round-trips during src/ writes.
 *
 * Parses pipeline/code-review/by-*.md files for per-area section headers and
 * REVIEW: markers, then updates the corresponding stage-06-<area>.json gates.
 *
 * Concurrency safety:
 *   - Acquires a per-gate .stage-06-<area>.lock file (atomic O_EXCL create)
 *     before the read-modify-write cycle.
 *   - Stale locks (> LOCK_STALE_MS) are cleared automatically.
 *   - Falls back to non-locked write on read-only filesystems (lock creation
 *     fails with EROFS/EACCES/EPERM) so the script never blocks CI.
 *   - Writes the updated gate atomically via tmp-file rename to avoid partial
 *     JSON on crash.
 *
 * Conservative parsing:
 *   - Only accepts "REVIEW: APPROVED" or "REVIEW: CHANGES REQUESTED" on its
 *     own line (case-insensitive, leading whitespace allowed).
 *   - Deduplicates approvals by reviewer name (append-only within a run).
 *   - Preserves existing entries; updates status to PASS only when
 *     approvals >= required_approvals AND changes_requested is empty.
 *   - Exits 0 on any parse error or file-not-found (surfaces WARN to stderr
 *     but never halts the pipeline on a hook bug).
 */

const fs = require("node:fs");
const path = require("node:path");

// Resolve cwd through symlinks for stable path comparisons on macOS.
const ROOT = (() => {
  try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
})();

const REVIEW_DIR = path.join(ROOT, "pipeline", "code-review");
const GATES_DIR = path.join(ROOT, "pipeline", "gates");

// Lock tuning
const LOCK_RETRIES = 20;
const LOCK_DELAY_MS = 30;
const LOCK_STALE_MS = 30000; // clear locks held for > 30 s (crashed process)

const REVIEWER_MAP = {
  backend: "backend",
  frontend: "frontend",
  platform: "platform",
  qa: "qa",
  security: "security",
  principal: "principal",
};

const KNOWN_AREAS = new Set(["backend", "frontend", "platform", "qa", "security", "deps"]);
const HEADER_RE = /^##\s+Review\s+of\s+([\w-]+)\s*$/i;
const MARKER_RE = /^\s*REVIEW:\s*(APPROVED|CHANGES\s+REQUESTED)\s*$/i;

// ---------------------------------------------------------------------------
// Stdin parsing — read the PostToolUse context to get the written file path.
// ---------------------------------------------------------------------------

function getToolFilePath() {
  try {
    if (process.stdin.isTTY) return null;

    const chunks = [];
    const buf = Buffer.alloc(65536);
    let n;
    while ((n = fs.readSync(0, buf, 0, buf.length)) > 0) {
      chunks.push(Buffer.from(buf.slice(0, n)));
      if (chunks.reduce((sum, c) => sum + c.length, 0) > 4 * 1024 * 1024) break;
    }
    if (chunks.length === 0) return null;

    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return data &&
      data.tool_input &&
      typeof data.tool_input.file_path === "string"
      ? data.tool_input.file_path
      : null;
  } catch {
    return null;
  }
}

/** Returns true when filePath is inside pipeline/code-review/. */
function isReviewFile(filePath) {
  if (!filePath) return false;
  let normalized;
  try {
    normalized = fs.realpathSync(
      path.isAbsolute(filePath) ? filePath : path.resolve(filePath),
    );
  } catch {
    normalized = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  }
  return normalized.startsWith(REVIEW_DIR + path.sep);
}

// ---------------------------------------------------------------------------
// File-based locking — spin-lock via O_EXCL for the gate read-modify-write.
// ---------------------------------------------------------------------------

/** Acquire an exclusive lock. Returns true on success, false on timeout/error. */
function acquireLock(lockPath) {
  // Remove a stale lock left by a crashed process.
  if (fs.existsSync(lockPath)) {
    try {
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > LOCK_STALE_MS) fs.unlinkSync(lockPath);
    } catch {
      // Another concurrent process may have already removed it.
    }
  }

  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      // O_EXCL: create fails if the file exists — atomic test-and-set.
      fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      return true;
    } catch (err) {
      if (err.code === "EEXIST") {
        // Spin-wait before retrying.
        const end = Date.now() + LOCK_DELAY_MS;
        while (Date.now() < end) { /* busy wait */ }
      } else if (err.code === "EROFS" || err.code === "EACCES" || err.code === "EPERM") {
        // Read-only or no-permission filesystem — fall back to unlocked mode.
        return false;
      } else {
        // Unexpected error — fall back to unlocked mode rather than crashing.
        return false;
      }
    }
  }
  return false;
}

/** Release the lock. Silently ignores missing-file errors. */
function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Review file parsing
// ---------------------------------------------------------------------------

function reviewerName(filePath) {
  const match = path.basename(filePath).match(/^by-([\w-]+)\.md$/);
  if (!match) return null;
  return REVIEWER_MAP[match[1]] || match[1];
}

/**
 * Parse a review file for per-area verdicts.
 * Returns: Array<{ area: string, verdict: "APPROVED" | "CHANGES_REQUESTED" }>
 */
function parseReview(content) {
  const verdicts = [];
  let area = null;

  for (const line of content.split(/\r?\n/)) {
    const header = line.match(HEADER_RE);
    if (header) {
      area = header[1].toLowerCase();
      continue;
    }

    const marker = line.match(MARKER_RE);
    if (marker && area && KNOWN_AREAS.has(area)) {
      verdicts.push({
        area,
        verdict: marker[1].toUpperCase().replace(/\s+/g, "_"),
      });
      // One verdict per section; require a new header for the next area.
      area = null;
    }
  }

  return verdicts;
}

// ---------------------------------------------------------------------------
// Gate upsert — locked read-modify-write with atomic rename write.
// ---------------------------------------------------------------------------

function readGate(gatePath, area) {
  if (fs.existsSync(gatePath)) {
    try {
      return JSON.parse(fs.readFileSync(gatePath, "utf8"));
    } catch {
      // Malformed gate — log and return null to signal skip.
      console.warn(`approval derivation warning: ${gatePath} is malformed; skipping update`);
      return null;
    }
  }

  return {
    stage: `stage-06-${area}`,
    status: "FAIL",
    agent: "codex-team",
    track: "full",
    timestamp: new Date().toISOString(),
    blockers: [],
    warnings: [],
    area,
    review_shape: "matrix",
    required_approvals: 2,
    approvals: [],
    changes_requested: [],
    escalated_to_principal: false,
  };
}

function applyVerdict({ area, verdict, reviewer }) {
  fs.mkdirSync(GATES_DIR, { recursive: true });

  const gatePath = path.join(GATES_DIR, `stage-06-${area}.json`);
  const lockPath = path.join(GATES_DIR, `.stage-06-${area}.lock`);

  const locked = acquireLock(lockPath);

  try {
    const gate = readGate(gatePath, area);
    if (gate === null) return; // malformed existing gate — skip

    gate.approvals = Array.isArray(gate.approvals) ? gate.approvals : [];
    gate.changes_requested = Array.isArray(gate.changes_requested)
      ? gate.changes_requested
      : [];

    if (verdict === "APPROVED") {
      if (!gate.approvals.includes(reviewer)) gate.approvals.push(reviewer);
      gate.changes_requested = gate.changes_requested.filter((entry) => entry.reviewer !== reviewer);
    }

    if (verdict === "CHANGES_REQUESTED") {
      gate.approvals = gate.approvals.filter((name) => name !== reviewer);
      if (!gate.changes_requested.some((entry) => entry.reviewer === reviewer)) {
        gate.changes_requested.push({ reviewer, timestamp: new Date().toISOString() });
      }
    }

    const required = Number.isInteger(gate.required_approvals) ? gate.required_approvals : 2;
    gate.status = gate.approvals.length >= required && gate.changes_requested.length === 0
      ? "PASS"
      : "FAIL";
    gate.timestamp = new Date().toISOString();

    // Atomic write: write to a temp file then rename into place.
    const tmpPath = `${gatePath}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(gate, null, 2)}\n`);
    fs.renameSync(tmpPath, gatePath);

    console.log(`${reviewer} -> ${verdict} on ${area}: ${gate.status}`);
  } finally {
    if (locked) releaseLock(lockPath);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Early exit: if the hook context tells us which file was just written and
  // it is NOT inside pipeline/code-review/, there is nothing to derive.
  // Falls back to the full scan when stdin is empty (e.g. manual invocation).
  const writtenPath = getToolFilePath();
  if (writtenPath !== null && !isReviewFile(writtenPath)) {
    return 0;
  }

  if (!fs.existsSync(REVIEW_DIR)) return 0;

  const files = fs.readdirSync(REVIEW_DIR)
    .filter((name) => /^by-[\w-]+\.md$/.test(name));

  for (const file of files) {
    const full = path.join(REVIEW_DIR, file);
    const reviewer = reviewerName(full);
    if (!reviewer) continue;
    try {
      const verdicts = parseReview(fs.readFileSync(full, "utf8"));
      for (const verdict of verdicts) {
        applyVerdict({ ...verdict, reviewer });
      }
    } catch (err) {
      console.warn(`approval derivation warning: ${err.message}`);
      // Never halt on hook bug — continue to the next file.
    }
  }

  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    console.warn(`approval derivation warning: ${err.message}`);
    process.exit(0);
  }
}

module.exports = { parseReview, applyVerdict, main };
