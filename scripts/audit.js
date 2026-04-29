#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, "docs", "audit");

const FULL_OUTPUTS = [
  ["00-project-context.md", "# Project Context\n\n## Scope\n\nTBD\n"],
  ["01-architecture.md", "# Architecture Map\n\n## Components\n\nTBD\n"],
  ["04-tests.md", "# Test Health\n\n## Findings\n\nTBD\n"],
  ["06-security.md", "# Security Review\n\n## Findings\n\nTBD\n"],
  ["08-code-quality.md", "# Code Quality\n\n## Findings\n\nTBD\n"],
  ["09-backlog.md", "# Improvement Backlog\n\n## Items\n\nTBD\n"],
  ["10-roadmap.md", "# Improvement Roadmap\n\n| # | Item | Impact | Effort | Risk | Verification | Areas |\n|---|---|---|---|---|---|---|\n"],
];

const QUICK_OUTPUTS = FULL_OUTPUTS.slice(0, 2);

function writeIfMissing(name, content) {
  const full = path.join(AUDIT_DIR, name);
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, content.endsWith("\n") ? content : `${content}\n`);
    return true;
  }
  return false;
}

function writeStatus({ mode, scope, outputs }) {
  const status = {
    mode,
    scope: scope || "whole project",
    status: "scaffolded",
    updated_at: new Date().toISOString(),
    outputs: outputs.map(([name]) => `docs/audit/${name}`),
    next_step: "Use the audit skill to replace placeholders with evidence-backed findings.",
  };
  fs.writeFileSync(path.join(AUDIT_DIR, "status.json"), `${JSON.stringify(status, null, 2)}\n`);
}

function scaffold(mode, scope) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const outputs = mode === "quick" || mode === "health-check" ? QUICK_OUTPUTS : FULL_OUTPUTS;
  for (const [name, content] of outputs) {
    const created = writeIfMissing(name, content);
    console.log(`${created ? "created" : "exists"} docs/audit/${name}`);
  }
  writeStatus({ mode, scope, outputs });
  console.log("wrote docs/audit/status.json");
  return 0;
}

function main() {
  const command = process.argv[2] || "full";
  const scope = process.argv.slice(3).join(" ");

  if (command === "full") return scaffold("full", scope);
  if (command === "quick") return scaffold("quick", scope);
  if (command === "health-check") return scaffold("health-check", scope);

  console.error(`Unknown audit command: ${command}`);
  console.error("Known audit commands: full, quick, health-check");
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { scaffold };
