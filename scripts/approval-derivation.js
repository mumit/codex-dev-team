#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const REVIEW_DIR = path.join(ROOT, "pipeline", "code-review");
const GATES_DIR = path.join(ROOT, "pipeline", "gates");

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

function reviewerName(filePath) {
  const match = path.basename(filePath).match(/^by-([\w-]+)\.md$/);
  if (!match) return null;
  return REVIEWER_MAP[match[1]] || match[1];
}

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
      area = null;
    }
  }

  return verdicts;
}

function readGate(gatePath, area) {
  if (fs.existsSync(gatePath)) {
    return JSON.parse(fs.readFileSync(gatePath, "utf8"));
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
  const gate = readGate(gatePath, area);

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

  fs.writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
  console.log(`${reviewer} -> ${verdict} on ${area}: ${gate.status}`);
}

function main() {
  if (!fs.existsSync(REVIEW_DIR)) return 0;

  const files = fs.readdirSync(REVIEW_DIR)
    .filter((name) => /^by-[\w-]+\.md$/.test(name));

  for (const file of files) {
    const full = path.join(REVIEW_DIR, file);
    const reviewer = reviewerName(full);
    if (!reviewer) continue;
    const verdicts = parseReview(fs.readFileSync(full, "utf8"));
    for (const verdict of verdicts) {
      applyVerdict({ ...verdict, reviewer });
    }
  }

  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    console.log(`approval derivation warning: ${err.message}`);
    process.exit(0);
  }
}

module.exports = { parseReview, applyVerdict, main };
