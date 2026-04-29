#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const REQUIRED = [
  ["pipeline/brief.md", "stage-01.json"],
  ["pipeline/design-spec.md", "stage-02.json"],
  ["pipeline/clarification-log.md", "stage-03.json"],
  ["pipeline/build-plan.md", "stage-04.json"],
  ["pipeline/pre-review.md", "stage-05.json"],
  ["pipeline/code-review/by-backend.md", "stage-06-backend.json"],
  ["pipeline/test-report.md", "stage-07.json"],
  ["pipeline/runbook.md", "stage-08.json"],
  ["pipeline/retrospective.md", "stage-09.json"],
];

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function checkConsistency() {
  const findings = [];

  for (const [artifact, gate] of REQUIRED) {
    const artifactExists = exists(artifact);
    const gateExists = exists(path.join("pipeline", "gates", gate));

    if (artifactExists && !gateExists) findings.push(`missing gate for ${artifact}: ${gate}`);
    if (gateExists && !artifactExists) findings.push(`missing artifact for ${gate}: ${artifact}`);
  }

  const gatesDir = path.join(ROOT, "pipeline", "gates");
  if (fs.existsSync(gatesDir)) {
    for (const name of fs.readdirSync(gatesDir).filter((entry) => entry.endsWith(".json"))) {
      const full = path.join(gatesDir, name);
      try {
        const gate = JSON.parse(fs.readFileSync(full, "utf8"));
        if (gate.stage && `${gate.stage}.json` !== name) {
          findings.push(`gate filename ${name} does not match stage ${gate.stage}`);
        }
      } catch {
        findings.push(`gate ${name} is not valid JSON`);
      }
    }
  }

  return findings;
}

function main() {
  const findings = checkConsistency();
  if (findings.length === 0) {
    console.log("Pipeline consistency OK.");
    return 0;
  }

  for (const finding of findings) console.error(`FAIL ${finding}`);
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { checkConsistency };
