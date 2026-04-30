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

const REQUIRED_RULES = [
  "coding-principles",
  "compaction",
  "escalation",
  "gates",
  "orchestrator",
  "pipeline",
  "retrospective",
];

const REQUIRED_SKILLS = [
  "api-conventions",
  "code-conventions",
  "implement",
  "pre-pr-review",
  "review-rubric",
  "security-checklist",
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

  const missingRules = REQUIRED_RULES.filter((name) => !fs.existsSync(path.join(ROOT, ".codex", "rules", `${name}.md`)));
  const missingSkills = REQUIRED_SKILLS.filter((name) => !fs.existsSync(path.join(ROOT, ".codex", "skills", name, "SKILL.md")));
  const gaps = (content.match(/Gap before v1\.0/g) || []).length;
  const partials = (content.match(/\| Partial \|/g) || []).length;
  if (missingRules.length > 0 || missingSkills.length > 0 || gaps > 0 || partials > 0) {
    for (const rule of missingRules) console.error(`missing Codex rule: ${rule}`);
    for (const skill of missingSkills) console.error(`missing Codex skill: ${skill}`);
    if (gaps > 0) console.error(`open v1.0 gap rows: ${gaps}`);
    if (partials > 0) console.error(`partial parity areas: ${partials}`);
    return 1;
  }

  console.log("Claude Dev Team parity checklist OK.");
  console.log(`Commands covered: ${REQUIRED_COMMANDS.length}/${REQUIRED_COMMANDS.length}`);
  console.log(`Rules covered: ${REQUIRED_RULES.length}/${REQUIRED_RULES.length}`);
  console.log(`Skills covered: ${REQUIRED_SKILLS.length}/${REQUIRED_SKILLS.length}`);
  console.log("Open v1.0 gaps: 0");
  console.log("Partial areas: 0");
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { REQUIRED_COMMANDS, REQUIRED_RULES, REQUIRED_SKILLS, main };
