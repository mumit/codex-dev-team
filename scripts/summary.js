#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const GATES_DIR = path.join(ROOT, "pipeline", "gates");
const SUMMARY = path.join(ROOT, "pipeline", "summary.md");

function readGates() {
  if (!fs.existsSync(GATES_DIR)) return [];
  return fs.readdirSync(GATES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const full = path.join(GATES_DIR, name);
      try {
        return { name, gate: JSON.parse(fs.readFileSync(full, "utf8")) };
      } catch {
        return { name, gate: { stage: name, status: "INVALID", agent: "unknown", blockers: ["Invalid JSON"] } };
      }
    });
}

function artifactStatus(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath)) ? "present" : "missing";
}

function readiness(gates) {
  if (gates.length === 0) return "not-started";
  if (gates.some(({ gate }) => gate.status === "INVALID")) return "invalid";
  if (gates.some(({ gate }) => gate.status === "ESCALATE")) return "blocked";
  if (gates.some(({ gate }) => gate.status === "FAIL")) return "in-progress";
  if (gates.every(({ gate }) => gate.status === "PASS")) return "ready";
  return "unknown";
}

function buildSummary() {
  const gates = readGates();
  const lines = [
    "# Pipeline Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Readiness: ${readiness(gates)}`,
    "",
    "## Gates",
    "",
    "| Gate | Stage | Status | Agent | Blockers |",
    "|---|---|---|---|---|",
  ];

  if (gates.length === 0) {
    lines.push("| none | - | - | - | - |");
  } else {
    for (const { name, gate } of gates) {
      const blockers = Array.isArray(gate.blockers) ? gate.blockers.length : 0;
      lines.push(`| ${name} | ${gate.stage || "-"} | ${gate.status || "-"} | ${gate.agent || "-"} | ${blockers} |`);
    }
  }

  lines.push(
    "",
    "## Artifacts",
    "",
    "| Artifact | Status |",
    "|---|---|",
  );

  for (const artifact of [
    "pipeline/brief.md",
    "pipeline/design-spec.md",
    "pipeline/clarification-log.md",
    "pipeline/build-plan.md",
    "pipeline/pre-review.md",
    "pipeline/test-report.md",
    "pipeline/runbook.md",
    "pipeline/retrospective.md",
  ]) {
    lines.push(`| ${artifact} | ${artifactStatus(artifact)} |`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  fs.mkdirSync(path.dirname(SUMMARY), { recursive: true });
  fs.writeFileSync(SUMMARY, buildSummary());
  console.log("wrote pipeline/summary.md");
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { buildSummary, readiness };
