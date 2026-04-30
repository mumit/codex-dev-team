#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const PARITY_DOC = path.join(ROOT, "docs", "parity", "claude-dev-team-parity.md");

const REQUIRED_COMMANDS = [
  "/adr",
  "/ask-pm",
  "/audit",
  "/audit-quick",
  "/config-only",
  "/dep-update",
  "/design",
  "/health-check",
  "/hotfix",
  "/nano",
  "/pipeline",
  "/pipeline-brief",
  "/pipeline-context",
  "/pipeline-review",
  "/principal-ruling",
  "/quick",
  "/reset",
  "/resume",
  "/retrospective",
  "/review",
  "/roadmap",
  "/stage",
  "/status",
];

function main() {
  if (!fs.existsSync(PARITY_DOC)) {
    console.error("missing docs/parity/claude-dev-team-parity.md");
    return 1;
  }

  const content = fs.readFileSync(PARITY_DOC, "utf8");
  const missing = REQUIRED_COMMANDS.filter((command) => !content.includes(`| \`${command}\``));
  if (missing.length > 0) {
    for (const command of missing) console.error(`missing command parity row: ${command}`);
    return 1;
  }

  const gaps = (content.match(/Gap before v1\.0/g) || []).length;
  const partials = (content.match(/\| Partial \|/g) || []).length;
  console.log("Claude Dev Team parity checklist OK.");
  console.log(`Commands covered: ${REQUIRED_COMMANDS.length}/${REQUIRED_COMMANDS.length}`);
  console.log(`Open v1.0 gaps: ${gaps}`);
  console.log(`Partial areas: ${partials}`);
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { REQUIRED_COMMANDS, main };
