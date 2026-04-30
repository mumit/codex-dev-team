#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = path.resolve(__dirname, "..");
const TARGET = path.resolve(process.argv[2] || process.cwd());

const PACKAGE_SCRIPTS = {
  help: "node scripts/codex-team.js help",
  status: "node scripts/codex-team.js status",
  next: "node scripts/codex-team.js next",
  summary: "node scripts/codex-team.js summary",
  roadmap: "node scripts/codex-team.js roadmap",
  validate: "node scripts/codex-team.js validate",
  doctor: "node scripts/codex-team.js doctor",
  "pipeline:check": "node scripts/consistency.js",
  pipeline: "node scripts/codex-team.js pipeline",
  "pipeline:scaffold": "node scripts/codex-team.js pipeline:scaffold",
  "pipeline:brief": "node scripts/codex-team.js pipeline-brief",
  "pipeline:review": "node scripts/codex-team.js pipeline-review",
  "pipeline:context": "node scripts/codex-team.js pipeline-context",
  design: "node scripts/codex-team.js design",
  retrospective: "node scripts/codex-team.js retrospective",
  "ask-pm": "node scripts/codex-team.js ask-pm",
  "principal-ruling": "node scripts/codex-team.js principal-ruling",
  adr: "node scripts/codex-team.js adr",
  resume: "node scripts/codex-team.js resume",
  stage: "node scripts/codex-team.js stage",
  prompt: "node scripts/codex-team.js prompt",
  role: "node scripts/codex-team.js role",
  audit: "node scripts/codex-team.js audit",
  "audit:quick": "node scripts/codex-team.js audit-quick",
  "health-check": "node scripts/codex-team.js health-check",
  "review:derive": "node scripts/approval-derivation.js",
  "security:check": "node scripts/security-heuristic.js",
  "runbook:check": "node scripts/runbook-check.js",
  lessons: "node scripts/codex-team.js lessons",
  "pr:pack": "node scripts/pr-pack.js",
};

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "config.local.yml" || entry.name.includes(".local.")) {
      continue;
    }
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function copyFileIfMissing(src, dest) {
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}

function appendGitignore(target) {
  const gitignore = path.join(target, ".gitignore");
  if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, "");
  const content = fs.readFileSync(gitignore, "utf8");
  if (content.includes("pipeline/gates/")) return;
  fs.appendFileSync(gitignore, `

# Codex Dev Team runtime artifacts
pipeline/brief.md
pipeline/design-spec.md
pipeline/design-review-notes.md
pipeline/pr-*.md
pipeline/code-review/
pipeline/test-report.md
pipeline/deploy-log.md
pipeline/gates/
pipeline/adr/

# Codex Dev Team local overrides
.codex/**/*.local.*
.codex/config.local.yml
AGENTS.local.md
`);
}

function addPackageScripts(target) {
  const packagePath = path.join(target, "package.json");
  if (!fs.existsSync(packagePath)) return;

  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  pkg.scripts = pkg.scripts || {};
  let changed = false;
  for (const [name, command] of Object.entries(PACKAGE_SCRIPTS)) {
    if (!pkg.scripts[name]) {
      pkg.scripts[name] = command;
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function main() {
  if (!fs.existsSync(TARGET) || !fs.statSync(TARGET).isDirectory()) {
    console.error(`Target directory does not exist: ${TARGET}`);
    process.exit(1);
  }

  copyDir(path.join(SOURCE, ".codex"), path.join(TARGET, ".codex"));
  copyDir(path.join(SOURCE, "scripts"), path.join(TARGET, "scripts"));
  copyDir(path.join(SOURCE, "schemas"), path.join(TARGET, "schemas"));
  copyDir(path.join(SOURCE, "templates"), path.join(TARGET, "templates"));

  copyFileIfMissing(path.join(SOURCE, "AGENTS.md"), path.join(TARGET, "AGENTS.md"));
  fs.mkdirSync(path.join(TARGET, "pipeline"), { recursive: true });
  copyFileIfMissing(path.join(SOURCE, "pipeline", "context.md"), path.join(TARGET, "pipeline", "context.md"));
  copyFileIfMissing(path.join(SOURCE, "pipeline", "lessons-learned.md"), path.join(TARGET, "pipeline", "lessons-learned.md"));

  fs.mkdirSync(path.join(TARGET, "pipeline", "gates"), { recursive: true });
  fs.mkdirSync(path.join(TARGET, "pipeline", "adr"), { recursive: true });
  fs.mkdirSync(path.join(TARGET, "pipeline", "code-review"), { recursive: true });
  fs.mkdirSync(path.join(TARGET, "src", "backend"), { recursive: true });
  fs.mkdirSync(path.join(TARGET, "src", "frontend"), { recursive: true });
  fs.mkdirSync(path.join(TARGET, "src", "infra"), { recursive: true });
  fs.mkdirSync(path.join(TARGET, "src", "tests"), { recursive: true });

  fs.copyFileSync(path.join(SOURCE, "VERSION"), path.join(TARGET, ".codex", "VERSION"));
  appendGitignore(TARGET);
  addPackageScripts(TARGET);

  console.log(`Codex Dev Team installed into ${TARGET}`);
}

if (require.main === module) {
  main();
}

module.exports = { PACKAGE_SCRIPTS };
