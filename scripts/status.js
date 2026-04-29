#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const GATES_DIR = path.join(process.cwd(), "pipeline", "gates");
const ROOT = process.cwd();

const ARTIFACTS = [
  "pipeline/brief.md",
  "pipeline/design-spec.md",
  "pipeline/clarification-log.md",
  "pipeline/build-plan.md",
  "pipeline/pre-review.md",
  "pipeline/test-report.md",
  "pipeline/runbook.md",
  "pipeline/retrospective.md",
  "pipeline/lessons-learned.md",
  "docs/audit/status.json",
  "docs/audit/10-roadmap.md",
];

function gates() {
  if (!fs.existsSync(GATES_DIR)) return [];
  return fs.readdirSync(GATES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const full = path.join(GATES_DIR, name);
      try {
        return { name, gate: JSON.parse(fs.readFileSync(full, "utf8")) };
      } catch {
        return { name, gate: { status: "INVALID", stage: name } };
      }
    });
}

function readiness(rows) {
  if (rows.length === 0) return "not-started";
  if (rows.some(({ gate }) => gate.status === "INVALID")) return "invalid";
  if (rows.some(({ gate }) => gate.status === "ESCALATE")) return "blocked";
  if (rows.some(({ gate }) => gate.status === "FAIL")) return "in-progress";
  if (rows.every(({ gate }) => gate.status === "PASS")) return "ready";
  return "unknown";
}

function artifactRows() {
  return ARTIFACTS.map((artifact) => ({
    artifact,
    status: fs.existsSync(path.join(ROOT, artifact)) ? "present" : "missing",
  }));
}

function statusPayload() {
  const rows = gates();
  return {
    readiness: readiness(rows),
    gates: rows.map(({ name, gate }) => ({
      name,
      stage: gate.stage || "",
      status: gate.status || "",
      agent: gate.agent || "",
      blockers: Array.isArray(gate.blockers) ? gate.blockers.length : 0,
    })),
    artifacts: artifactRows(),
  };
}

function main() {
  const payload = statusPayload();
  const rows = payload.gates.map(({ name, ...gate }) => ({ name, gate }));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log("Codex Dev Team Status");
  console.log("=====================");
  console.log(`Readiness: ${payload.readiness}`);
  console.log(`Gates: ${payload.gates.length}`);

  if (rows.length === 0) {
    console.log("No gate files found.");
  } else {
    for (const { name, gate } of rows) {
      const blockers = Array.isArray(gate.blockers) && gate.blockers.length > 0
        ? ` blockers=${gate.blockers.length}`
        : "";
      console.log(`${name}: ${gate.status} ${gate.stage || ""} ${gate.agent || ""}${blockers}`.trim());
    }
  }

  console.log("");
  console.log("Artifacts");
  console.log("=========");
  for (const { artifact, status } of payload.artifacts) {
    console.log(`${status} ${artifact}`);
  }

  const auditStatusPath = path.join(ROOT, "docs", "audit", "status.json");
  if (fs.existsSync(auditStatusPath)) {
    try {
      const audit = JSON.parse(fs.readFileSync(auditStatusPath, "utf8"));
      console.log("");
      console.log("Audit");
      console.log("=====");
      console.log(`mode=${audit.mode || "unknown"} scope=${audit.scope || "unknown"} status=${audit.status || "unknown"}`);
    } catch {
      console.log("");
      console.log("Audit");
      console.log("=====");
      console.log("status=INVALID docs/audit/status.json");
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { gates, readiness, statusPayload };
