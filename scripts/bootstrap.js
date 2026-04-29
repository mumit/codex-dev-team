#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = path.resolve(__dirname, "..");
const TARGET = path.resolve(process.argv[2] || process.cwd());

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

  console.log(`Codex Dev Team installed into ${TARGET}`);
}

main();
