#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const PARITY_DOC = path.join(ROOT, "docs", "parity", "claude-dev-team-parity.md");
const PIPELINE_RULE = path.join(ROOT, ".codex", "rules", "pipeline.md");
const CONFIG_FILE = path.join(ROOT, ".codex", "config.yml");
const AUDIT_PHASES = path.join(ROOT, ".codex", "references", "audit-phases.md");

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

// Required top-level config keys (simple line-grep, no yaml dep).
const REQUIRED_CONFIG_KEYS = [
  "budget",
  "checkpoints",
  "security",
  "deploy",
  "pipeline",
  "execution",
  "framework",
];

// Required stoplist strings in pipeline.md.
const REQUIRED_STOPLIST_STRINGS = [
  "Safety stoplist",
  "Authentication",
  "Cryptography",
  "PII",
];

// Minimum line count for each role prompt.
const ROLE_PROMPT_MIN_LINES = 60;

// Minimum line count for audit-phases reference.
const AUDIT_PHASES_MIN_LINES = 100;

// ---------------------------------------------------------------------------
// Individual check functions — exported for tests.
// ---------------------------------------------------------------------------

/** Check: parity doc exists and has all command rows. */
function checkCommands(root) {
  const doc = path.join(root, "docs", "parity", "claude-dev-team-parity.md");
  if (!fs.existsSync(doc)) {
    return [`missing docs/parity/claude-dev-team-parity.md`];
  }
  const content = fs.readFileSync(doc, "utf8");
  const missing = REQUIRED_COMMANDS.filter((command) => !content.includes(`| \`${command}\``));
  return missing.map((c) => `missing command parity row: ${c}`);
}

/** Check: all required rule files exist. */
function checkRules(root) {
  const missing = REQUIRED_RULES.filter(
    (name) => !fs.existsSync(path.join(root, ".codex", "rules", `${name}.md`))
  );
  return missing.map((r) => `missing Codex rule: ${r}`);
}

/** Check: all required skill dirs exist. */
function checkSkills(root) {
  const missing = REQUIRED_SKILLS.filter(
    (name) => !fs.existsSync(path.join(root, ".codex", "skills", name, "SKILL.md"))
  );
  return missing.map((s) => `missing Codex skill: ${s}`);
}

/** Check: no open v1.0 gap rows or partial areas in parity doc. */
function checkGapsAndPartials(root) {
  const doc = path.join(root, "docs", "parity", "claude-dev-team-parity.md");
  if (!fs.existsSync(doc)) return [];
  const content = fs.readFileSync(doc, "utf8");
  const errors = [];
  const gaps = (content.match(/Gap before v1\.0/g) || []).length;
  const partials = (content.match(/\| Partial \|/g) || []).length;
  if (gaps > 0) errors.push(`open v1.0 gap rows: ${gaps}`);
  if (partials > 0) errors.push(`partial parity areas: ${partials}`);
  return errors;
}

/** Check: role prompt files meet minimum line count. */
function checkRolePromptLines(root) {
  const rolesDir = path.join(root, ".codex", "prompts", "roles");
  if (!fs.existsSync(rolesDir)) return [`missing .codex/prompts/roles/ directory`];
  const errors = [];
  const files = fs.readdirSync(rolesDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const fullPath = path.join(rolesDir, file);
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/).length;
    if (lines < ROLE_PROMPT_MIN_LINES) {
      errors.push(`role prompt ${file} too short: ${lines} lines (min ${ROLE_PROMPT_MIN_LINES})`);
    }
  }
  return errors;
}

/** Check: .codex/config.yml has all required top-level keys. */
function checkConfigKeys(root) {
  const configPath = path.join(root, ".codex", "config.yml");
  if (!fs.existsSync(configPath)) return [`missing .codex/config.yml`];
  const content = fs.readFileSync(configPath, "utf8");
  const errors = [];
  for (const key of REQUIRED_CONFIG_KEYS) {
    // Top-level key: line starts with key: (optional leading whitespace for safety)
    const re = new RegExp(`^${key}:`, "m");
    if (!re.test(content)) {
      errors.push(`config.yml missing top-level key: ${key}`);
    }
  }
  return errors;
}

/** Check: .codex/rules/pipeline.md contains required stoplist strings. */
function checkStoplistContent(root) {
  const pipelinePath = path.join(root, ".codex", "rules", "pipeline.md");
  if (!fs.existsSync(pipelinePath)) return [`missing .codex/rules/pipeline.md`];
  const content = fs.readFileSync(pipelinePath, "utf8");
  const errors = [];
  for (const str of REQUIRED_STOPLIST_STRINGS) {
    if (!content.includes(str)) {
      errors.push(`pipeline.md missing required stoplist string: "${str}"`);
    }
  }
  return errors;
}

/** Check: parity doc contains ## Stage Numbering Divergence heading. */
function checkStageDivergenceDoc(root) {
  const doc = path.join(root, "docs", "parity", "claude-dev-team-parity.md");
  if (!fs.existsSync(doc)) return [`missing docs/parity/claude-dev-team-parity.md`];
  const content = fs.readFileSync(doc, "utf8");
  if (!content.includes("## Stage Numbering Divergence")) {
    return [`parity doc missing "## Stage Numbering Divergence" heading`];
  }
  return [];
}

/** Check: .codex/references/audit-phases.md exists and meets min line count. */
function checkAuditPhases(root) {
  const phaseDoc = path.join(root, ".codex", "references", "audit-phases.md");
  if (!fs.existsSync(phaseDoc)) {
    return [`missing .codex/references/audit-phases.md`];
  }
  const lines = fs.readFileSync(phaseDoc, "utf8").split(/\r?\n/).length;
  if (lines < AUDIT_PHASES_MIN_LINES) {
    return [`audit-phases.md too short: ${lines} lines (min ${AUDIT_PHASES_MIN_LINES})`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(root) {
  root = root || ROOT;
  const allErrors = [
    ...checkCommands(root),
    ...checkRules(root),
    ...checkSkills(root),
    ...checkGapsAndPartials(root),
    ...checkRolePromptLines(root),
    ...checkConfigKeys(root),
    ...checkStoplistContent(root),
    ...checkStageDivergenceDoc(root),
    ...checkAuditPhases(root),
  ];

  if (allErrors.length > 0) {
    for (const err of allErrors) console.error(err);
    return 1;
  }

  console.log("PARITY OK (deep)");
  console.log(`Commands covered: ${REQUIRED_COMMANDS.length}/${REQUIRED_COMMANDS.length}`);
  console.log(`Rules covered: ${REQUIRED_RULES.length}/${REQUIRED_RULES.length}`);
  console.log(`Skills covered: ${REQUIRED_SKILLS.length}/${REQUIRED_SKILLS.length}`);
  console.log("Role prompts: line counts OK");
  console.log("Config keys: OK");
  console.log("Stoplist content: OK");
  console.log("Stage divergence doc: OK");
  console.log("Audit phases reference: OK");
  console.log("Open v1.0 gaps: 0");
  console.log("Partial areas: 0");
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  main,
  checkCommands,
  checkRules,
  checkSkills,
  checkGapsAndPartials,
  checkRolePromptLines,
  checkConfigKeys,
  checkStoplistContent,
  checkStageDivergenceDoc,
  checkAuditPhases,
  REQUIRED_COMMANDS,
  REQUIRED_RULES,
  REQUIRED_SKILLS,
};
