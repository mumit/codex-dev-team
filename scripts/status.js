#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

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

function root() {
  return process.cwd();
}

function gatesDir() {
  return path.join(root(), "pipeline", "gates");
}

function contextPath() {
  return path.join(root(), "pipeline", "context.md");
}

function contextSignals() {
  const file = contextPath();
  const signals = {
    questions: {
      total: 0,
      open: 0,
      answered: 0,
      latestOpen: [],
    },
    principalRulingRequests: {
      total: 0,
      latest: [],
    },
    resumes: {
      total: 0,
      latest: [],
    },
    keyDecisions: {
      total: 0,
      latest: [],
    },
  };

  if (!fs.existsSync(file)) return signals;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let pendingQuestion = null;

  function pushLatest(collection, value, max = 3) {
    collection.unshift(value);
    if (collection.length > max) collection.pop();
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("QUESTION:")) {
      if (pendingQuestion) {
        signals.questions.open += 1;
        pushLatest(signals.questions.latestOpen, pendingQuestion);
      }
      pendingQuestion = trimmed.slice("QUESTION:".length).trim();
      signals.questions.total += 1;
      continue;
    }

    if (trimmed.startsWith("PM-ANSWER:")) {
      if (pendingQuestion) {
        signals.questions.answered += 1;
        pendingQuestion = null;
      }
      continue;
    }

    if (pendingQuestion) {
      signals.questions.open += 1;
      pushLatest(signals.questions.latestOpen, pendingQuestion);
      pendingQuestion = null;
    }

    if (trimmed.startsWith("PRINCIPAL-RULING-REQUEST:")) {
      signals.principalRulingRequests.total += 1;
      pushLatest(
        signals.principalRulingRequests.latest,
        trimmed.slice("PRINCIPAL-RULING-REQUEST:".length).trim(),
      );
      continue;
    }

    if (trimmed.includes(" - RESUME: ")) {
      signals.resumes.total += 1;
      pushLatest(signals.resumes.latest, trimmed);
      continue;
    }

    if (trimmed.includes(" - ADR ") || trimmed.startsWith("KEY-DECISION:")) {
      signals.keyDecisions.total += 1;
      pushLatest(signals.keyDecisions.latest, trimmed);
    }
  }

  if (pendingQuestion) {
    signals.questions.open += 1;
    pushLatest(signals.questions.latestOpen, pendingQuestion);
  }

  return signals;
}

function gates() {
  const dir = gatesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const full = path.join(dir, name);
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
    status: fs.existsSync(path.join(root(), artifact)) ? "present" : "missing",
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
    context: contextSignals(),
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

  console.log("");
  console.log("Context Signals");
  console.log("===============");
  console.log(`Questions: ${payload.context.questions.open} open / ${payload.context.questions.answered} answered / ${payload.context.questions.total} total`);
  console.log(`Principal ruling requests: ${payload.context.principalRulingRequests.total}`);
  console.log(`Resume notes: ${payload.context.resumes.total}`);
  console.log(`Key decisions: ${payload.context.keyDecisions.total}`);
  for (const question of payload.context.questions.latestOpen) {
    console.log(`open QUESTION: ${question}`);
  }
  for (const request of payload.context.principalRulingRequests.latest) {
    console.log(`pending PRINCIPAL-RULING-REQUEST: ${request}`);
  }

  const auditStatusPath = path.join(root(), "docs", "audit", "status.json");
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

module.exports = { contextSignals, gates, readiness, statusPayload };
